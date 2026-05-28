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
  postToChannel,
  getPermalink,
  addReaction,
} from './slackClient';
import {
  buildSimilarReportsMessage,
  buildNoSimilarReportsMessage,
  buildChannelResolvedNotification,
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
    excludeSlackChannelId: channel,
    excludeSlackThreadTs: threadTs,
  });

  // `actionValue` serializa channel+threadTs no botao pra que o handler
  // de interactivity nao precise persistir estado entre cliques.
  const actionValue = JSON.stringify({ channel, threadTs });

  if (similar.length === 0) {
    console.log(`[slack-reports] No similar reports for ${channel}/${threadTs}`);
    const msg = buildNoSimilarReportsMessage(actionValue);
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
 * Roda quando o usuario clica em "Marcar como resolvido" (ou, como
 * fallback, reage com ✅ em qualquer mensagem da thread). Busca conteudo
 * completo, analisa com GPT, persiste Report+embedding e dispara tres
 * sinais visuais de resolucao:
 *
 *   1. Reage ✅ na mensagem-pai (origem da thread) — visivel no feed do
 *      canal pra quem so passa olhando.
 *   2. Posta uma mensagem no canal (fora da thread) anunciando a
 *      resolucao com link permalink — quem nao tava na thread fica
 *      sabendo que aquele assunto foi fechado.
 *   3. (Caller do botao) edita o card original removendo botoes e
 *      mostrando "Resolvido em DD/MM por @user" — feito em routes.ts
 *      no momento do clique pra dar feedback instantaneo, antes deste
 *      processResolution (que demora pelo GPT) acabar.
 *
 * Idempotente: se ja existe report pra esse channel+threadTs, faz
 * UPDATE da solucao ao inves de novo INSERT.
 */
export async function processResolution(opts: {
  channel: string;
  threadTs: string;
  resolvedByUserId?: string;
}): Promise<void> {
  const { channel, threadTs, resolvedByUserId } = opts;

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

  // Sinal 1: ✅ na mensagem-pai. Como o disparo agora vem de um botao
  // (clique explicito do usuario), o ✅ na pai eh sinal sem ambiguidade
  // de que aquele assunto foi marcado como resolvido — fica visivel pra
  // quem ta scrolling no canal sem abrir thread.
  await addReaction({
    channel,
    timestamp: threadTs,
    name: SLACK_REPORTS_CONFIG.resolutionReaction,
  });

  // Sinal 2: post no canal (fora da thread) anunciando a resolucao.
  // Permite o time todo saber que a thread foi fechada sem precisar
  // re-abrir e ler. Linka pra thread via permalink pra dar contexto.
  if (resolvedByUserId) {
    const permalink = await getPermalink({
      channel,
      messageTs: threadTs,
    });
    const notification = buildChannelResolvedNotification({
      resolvedByUserId,
      resolvedAt: new Date(),
      threadPermalink: permalink,
      reportTitle: title,
    });
    await postToChannel({ channel, ...notification });
  }

  console.log(
    `[slack-reports] Resolution processed: report id=${report.id} category=${category} by=${resolvedByUserId ?? 'unknown'}`
  );
}
