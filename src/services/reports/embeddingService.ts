import { generateEmbedding } from "./aiService";
import prisma from "../prisma";

const SIMILARITY_THRESHOLD = parseFloat(
  process.env.SIMILARITY_THRESHOLD || "0.5"
);
const MAX_SIMILAR_REPORTS = parseInt(process.env.MAX_SIMILAR_REPORTS || "10");

export interface SimilarReport {
  id: bigint;
  discordThreadId: string;
  discordUserId: string;
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

export async function findSimilarReports(
  text: string,
  excludeThreadId?: string
): Promise<SimilarReport[]> {
  const embedding = await generateEmbedding(text);
  const embeddingString = `[${embedding.join(",")}]`;

  const reports = await prisma.$queryRaw<SimilarReport[]>`
    SELECT 
      r.id,
      r.discord_thread_id as "discordThreadId",
      r.discord_user_id as "discordUserId",
      r.title,
      r.description,
      r.solution,
      r.category,
      r.resolved_at as "resolvedAt",
      r.created_at as "createdAt",
      1 - (e.embedding <=> ${embeddingString}::vector) as similarity
    FROM houston_bot_reports r
    JOIN houston_bot_report_embeddings e ON e.report_id = r.id
    WHERE 1 - (e.embedding <=> ${embeddingString}::vector) > ${SIMILARITY_THRESHOLD}
      AND r.discord_thread_id != ${excludeThreadId || ""}
    ORDER BY similarity DESC
    LIMIT ${MAX_SIMILAR_REPORTS}
  `;

  return reports;
}
