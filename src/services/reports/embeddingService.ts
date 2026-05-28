import { generateEmbedding } from "./aiService";
import prisma from "../prisma";

const SIMILARITY_THRESHOLD = parseFloat(
  process.env.SIMILARITY_THRESHOLD || "0.5"
);
const MAX_SIMILAR_REPORTS = parseInt(process.env.MAX_SIMILAR_REPORTS || "10");

// Weight for hybrid search: 70% semantic (vector) + 30% keyword (full-text)
const VECTOR_WEIGHT = 0.7;
const KEYWORD_WEIGHT = 0.3;

export interface SimilarReport {
  id: bigint;
  discordThreadId: string | null;
  discordUserId: string | null;
  slackChannelId?: string | null;
  slackThreadTs?: string | null;
  slackUserId?: string | null;
  title: string;
  description: string;
  solution: string | null;
  category: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  similarity: number;
}

export async function createReportEmbedding(
  reportId: bigint,
  text: string
): Promise<void> {
  const embedding = await generateEmbedding(text);
  const embeddingString = `[${embedding.join(",")}]`;

  await prisma.$executeRaw`
    INSERT INTO houston_bot_report_embeddings (report_id, embedding)
    VALUES (${reportId}, ${embeddingString}::vector)
    ON CONFLICT (report_id) 
    DO UPDATE SET embedding = ${embeddingString}::vector
  `;
}

export interface FindSimilarOpts {
  /**
   * Identificador da thread em curso, pra nao retornar ela propria como
   * "similar". Pro Discord e `discord_thread_id`; pro Slack a thread
   * fica identificada pelo par `(slack_channel_id, slack_thread_ts)` —
   * a query exclui o match exato de qualquer um dos dois identificadores
   * que tenha sido passado.
   *
   * A busca em si NAO filtra por plataforma — reports antigos do Discord
   * tambem entram no resultado pra uso como base de conhecimento. Quando
   * um match e de outra plataforma (ex.: Slack busca achou Discord), o
   * caller monta o card sem link clicavel.
   */
  excludeDiscordThreadId?: string;
  excludeSlackChannelId?: string;
  excludeSlackThreadTs?: string;
}

export async function findSimilarReports(
  text: string,
  opts: FindSimilarOpts
): Promise<SimilarReport[]> {
  const embedding = await generateEmbedding(text);
  const embeddingString = `[${embedding.join(",")}]`;

  // Hybrid search: combine vector similarity with keyword search
  interface RawReport extends SimilarReport {
    vectorScore: number;
    keywordScore: number;
  }

  const rawReports = await prisma.$queryRaw<RawReport[]>`
    SELECT
      r.id,
      r.discord_thread_id as "discordThreadId",
      r.discord_user_id as "discordUserId",
      r.slack_channel_id as "slackChannelId",
      r.slack_thread_ts as "slackThreadTs",
      r.slack_user_id as "slackUserId",
      r.title,
      r.description,
      r.solution,
      r.category,
      r.resolved_at as "resolvedAt",
      r.created_at as "createdAt",
      (1 - (e.embedding <=> ${embeddingString}::vector)) as "vectorScore",
      COALESCE(ts_rank(r.search_vector, plainto_tsquery('portuguese', ${text})), 0) as "keywordScore",
      (
        ${VECTOR_WEIGHT}::float * (1 - (e.embedding <=> ${embeddingString}::vector)) +
        ${KEYWORD_WEIGHT}::float * COALESCE(ts_rank(r.search_vector, plainto_tsquery('portuguese', ${text})), 0)
      ) as similarity
    FROM houston_bot_reports r
    JOIN houston_bot_report_embeddings e ON e.report_id = r.id
    WHERE
      r.solution IS NOT NULL
      AND (
        ${opts.excludeDiscordThreadId ?? null}::text IS NULL
        OR r.discord_thread_id IS DISTINCT FROM ${opts.excludeDiscordThreadId ?? null}
      )
      AND (
        ${opts.excludeSlackChannelId ?? null}::text IS NULL
        OR ${opts.excludeSlackThreadTs ?? null}::text IS NULL
        OR NOT (
          r.slack_channel_id = ${opts.excludeSlackChannelId ?? null}
          AND r.slack_thread_ts = ${opts.excludeSlackThreadTs ?? null}
        )
      )
    ORDER BY similarity DESC
    LIMIT ${MAX_SIMILAR_REPORTS}
  `;

  // Filter by threshold
  const reports = rawReports.filter(
    (report) => report.similarity > SIMILARITY_THRESHOLD
  );

  console.log(`[EmbeddingService] ${reports.length} reports passed similarity threshold (${SIMILARITY_THRESHOLD})`);

  return reports;
}
