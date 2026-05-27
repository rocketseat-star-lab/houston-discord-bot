import { findSimilarReports } from '../../../services/reports/embeddingService';
import {
  analyzeThreadForSolution,
  summarizeThread,
} from '../../../services/reports/aiService';
import { createReportEmbedding } from '../../../services/reports/embeddingService';
import {
  combineForEmbedding,
  combineForEmbeddingSummary,
} from '../../../services/reports/utils/textExtractor';
import {
  createReport,
  slackReportExists,
  updateSlackReportSolution,
} from '../../../services/reports/reportService';
import { ReportCategory } from '@prisma/client';
import {
  fetchSlackThread,
  postInThread,
  getPermalink,
  addReaction,
} from './slackClient';
import {
  buildSimilarReportsMessage,
  buildNoSimilarReportsMessage,
} from './messageBuilder';
import { SLACK_REPORTS_CONFIG } from '../config';

/**
 * Roda quando o debouncer dispara: busca thread completa, extrai
 * title+description, roda RAG (so contra reports SLACK), posta
 * sugestao com botoes ou mensagem de "nada similar".
 *
 * Idempotente: se a thread ja virou Report (resolvida antes), nao
 * posta sugestao de novo (assumimos que a primeira passagem ja foi).
 */
export async function processNewSlackThread(opts: {
  channel: string;
  threadTs: string;
}): Promise<void> {
  const { channel, threadTs } = opts;

  const exists = await slackReportExists(channel, threadTs);
  if (exists) {
    console.log(
      `[slack-reports] Thread ${channel}/${threadTs} ja persistida — skip da sugestao.`
    );
    return;
  }

  const content = await fetchSlackThread(channel, threadTs);
  if (!content) {
    console.warn(`[slack-reports] Thread ${channel}/${threadTs} retornou vazia.`);
    return;
  }

  const title = content.parent.text.trim();
  const description = content.replies
    .filter((m) => !m.isBot)
    .map((m) => m.text.trim())
    .filter(Boolean)
    .join('\n');

  const combinedText = combineForEmbedding(title, description);

  const similar = await findSimilarReports(combinedText, {
    platform: 'SLACK',
    excludeSlackChannelId: channel,
    excludeSlackThreadTs: threadTs,
  });

  if (similar.length === 0) {
    console.log(`[slack-reports] No similar reports for ${channel}/${threadTs}`);
    const msg = buildNoSimilarReportsMessage();
    await postInThread({ channel, threadTs, ...msg });
    return;
  }

  console.log(
    `[slack-reports] Found ${similar.length} similar reports for ${channel}/${threadTs}`
  );

  // Pre-gera permalinks (top 3) — usados nos blocks da mensagem.
  const permalinks = new Map<bigint, string | null>();
  for (const r of similar.slice(0, 3)) {
    if (r.slackChannelId && r.slackThreadTs) {
      const link = await getPermalink({
        channel: r.slackChannelId,
        messageTs: r.slackThreadTs,
      });
      permalinks.set(r.id, link);
    } else {
      permalinks.set(r.id, null);
    }
  }

  const msg = buildSimilarReportsMessage({
    reports: similar,
    permalinks,
    threadChannel: channel,
    threadTs,
  });
  await postInThread({ channel, threadTs, ...msg });
}

/**
 * Roda quando alguem reage com :white_check_mark: na mensagem-pai.
 * Busca conteudo completo, analisa com GPT, persiste Report+embedding.
 *
 * Idempotente: se ja existe report pra esse channel+threadTs, faz
 * UPDATE da solucao ao inves de novo INSERT.
 */
export async function processResolution(opts: {
  channel: string;
  threadTs: string;
}): Promise<void> {
  const { channel, threadTs } = opts;

  const content = await fetchSlackThread(channel, threadTs);
  if (!content) {
    console.warn(`[slack-reports] Resolution: thread ${channel}/${threadTs} vazia.`);
    return;
  }

  const title = content.parent.text.trim();
  const description = content.replies
    .filter((m) => !m.isBot)
    .map((m) => m.text.trim())
    .filter(Boolean)
    .join('\n');

  const allMessages = [content.parent, ...content.replies]
    .filter((m) => !m.isBot)
    .map((m) => `${m.user ?? 'usuario'}: ${m.text}`)
    .join('\n');

  const analysis = await analyzeThreadForSolution(allMessages);
  const category = analysis.category.toUpperCase() as ReportCategory;

  const exists = await slackReportExists(channel, threadTs);
  let report;
  if (exists) {
    report = await updateSlackReportSolution(channel, threadTs, analysis.solution, category);
  } else {
    report = await createReport({
      platform: 'SLACK',
      slackChannelId: channel,
      slackThreadTs: threadTs,
      slackUserId: content.parent.user,
      title,
      description,
      solution: analysis.solution,
      category,
      resolvedAt: new Date(),
    });
  }

  let embeddingText: string;
  try {
    const summary = await summarizeThread(allMessages);
    embeddingText = combineForEmbeddingSummary(title, summary);
  } catch (err) {
    console.warn('[slack-reports] summarizeThread falhou, usando title+description:', err);
    embeddingText = combineForEmbedding(title, description);
  }

  await createReportEmbedding(report.id, embeddingText);

  // Reage com checkmark na DESCRICAO (primeira reply nao-bot da thread)
  // em vez da mensagem-pai. Motivo: o canal mostra so a mensagem-pai sem
  // abrir a thread; ✅ visivel ali confundiria quem passa olhando o canal
  // (parece que o bug foi resolvido na hora pelo proprio autor). Colocar
  // dentro da thread mantem o sinal de "documentado" sem poluir o feed.
  // Fallback pra mensagem-pai apenas se a thread tiver so o titulo (caso
  // raro — quem reagiu sem ter descrito o problema).
  const firstReplyTs = content.replies.find((m) => !m.isBot)?.ts;
  await addReaction({
    channel,
    timestamp: firstReplyTs ?? threadTs,
    name: SLACK_REPORTS_CONFIG.resolutionReaction,
  });

  console.log(
    `[slack-reports] Resolution processed: report id=${report.id} category=${category}`
  );
}
