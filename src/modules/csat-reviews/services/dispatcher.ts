import { CSAT_REVIEWS_CONFIG } from '../config';
import { CsatFeedback, fetchSkylabFeedbacks } from './skylabClient';
import { getDispatchWindow, formatBR } from './dateLogic';
import { buildSummary, summaryMessage, CsatSummary } from './summaryBuilder';
import { formatFeedbackMessage } from './feedbackMessage';
import { slackPublisher } from './slackPublisher';
import { getCsatReviewsConfig } from './toolsConfigClient';
import { normalizeMessageFields } from './messageFields';

export interface DispatchResult {
  dryRun: boolean;
  dateCovered: string | null;
  summary: CsatSummary;
  feedbacks: CsatFeedback[];
  message?: string;
}

interface DispatchOptions {
  dryRun?: boolean;
  from?: string;
  to?: string;
  now?: Date;
}

function emptyResult(dryRun: boolean, message?: string): DispatchResult {
  return {
    dryRun,
    dateCovered: null,
    summary: { total: 0, withComment: 0, withoutComment: 0, likes: 0, dislikes: 0, likeRate: 0 },
    feedbacks: [],
    message,
  };
}

export async function dispatchCsatReviews(opts: DispatchOptions = {}): Promise<DispatchResult> {
  const dryRun = opts.dryRun ?? CSAT_REVIEWS_CONFIG.dryRun;
  const now = opts.now || new Date();

  // Permite override manual de from/to (vindo do botão "Enviar agora").
  let from: Date | null = null;
  let to: Date | null = null;
  let label = '';

  if (opts.from && opts.to) {
    from = new Date(opts.from);
    to = new Date(opts.to);
    label =
      from.toDateString() === to.toDateString()
        ? formatBR(from)
        : `${formatBR(from)} a ${formatBR(to)}`;
  } else {
    const window = getDispatchWindow(now);
    if (!window) {
      return emptyResult(dryRun, 'Hoje é fim de semana ou feriado, nada a enviar.');
    }
    from = window.from;
    to = window.to;
    label = window.label;
  }

  // Config from Tools — o dispatcher precisa apenas do canal. O flag
  // `enabled` controla so o cron e e checado no scheduler antes de chamar
  // o dispatcher, nao aqui. Assim o botao "Enviar agora" do Tools sempre
  // dispara quando clicado, sem depender do toggle.
  const config = await getCsatReviewsConfig();
  const slackChannelId = config?.slackChannelId || '';
  const messageFields = normalizeMessageFields(config?.messageFields);

  if (!dryRun && !slackChannelId) {
    return emptyResult(dryRun, 'Canal Slack não configurado nas configurações do Tools.');
  }

  // Busca feedbacks no banco read-only da Skylab
  const allFeedbacks = await fetchSkylabFeedbacks({ from, to });

  // Summary inclui todos (com ou sem comentário)
  const summary = buildSummary(allFeedbacks);

  // Mensagens individuais só para feedbacks com texto
  const commented = allFeedbacks.filter(
    (f) => f.comment && f.comment.trim().length > 0
  );

  if (allFeedbacks.length === 0) {
    return {
      ...emptyResult(dryRun, 'Sem feedbacks no período.'),
      dateCovered: label,
    };
  }

  if (dryRun) {
    return {
      dryRun: true,
      dateCovered: label,
      summary,
      feedbacks: commented,
    };
  }

  // Cria thread no Slack:
  //  - mensagem-pai (no canal): so o titulo, pra ficar enxuto no feed;
  //  - primeira reply na thread: o resumo (total, distribuicao, etc);
  //  - replies seguintes: um por feedback com comentario.
  // Cada execucao do dispatcher cria uma thread nova (postParent gera um novo ts).
  const isSingleDay = from.toDateString() === to.toDateString();
  const threadTitle = isSingleDay
    ? `*Feedbacks - dia ${formatBR(from)}*`
    : `*Feedbacks - ${formatBR(from)} a ${formatBR(to)}*`;

  const parentTs = await slackPublisher.postParent(slackChannelId, threadTitle);
  if (!parentTs) {
    return {
      ...emptyResult(dryRun, 'Falha ao criar a mensagem-pai no Slack.'),
      dateCovered: label,
    };
  }

  try {
    await slackPublisher.postReply(
      slackChannelId,
      parentTs,
      summaryMessage({ dateLabel: label, summary })
    );
  } catch (err) {
    console.error('[csat-reviews] failed to post summary reply:', err);
  }

  for (const f of commented) {
    try {
      await slackPublisher.postReply(slackChannelId, parentTs, formatFeedbackMessage(f, messageFields));
    } catch (err) {
      console.error('[csat-reviews] failed to post reply:', err);
    }
  }

  return {
    dryRun: false,
    dateCovered: label,
    summary,
    feedbacks: commented,
  };
}
