import { CSAT_REVIEWS_CONFIG } from '../config';
import { CsatFeedback, fetchMetabaseFeedbacks } from './metabaseClient';
import { getDispatchWindow, formatBR } from './dateLogic';
import { buildSummary, summaryMessage, CsatSummary } from './summaryBuilder';
import { formatFeedbackMessage } from './feedbackMessage';
import { slackPublisher } from './slackPublisher';
import { getCsatReviewsConfig } from './toolsConfigClient';

export interface DispatchResult {
  dryRun: boolean;
  dateCovered: string | null;
  summary: CsatSummary;
  feedbacks: CsatFeedback[];
  message?: string;
  // TEMP(csat-test): diagnóstico do fallback. Remover junto com o resto.
  _debug?: {
    metabaseKeyConfigured: boolean;
    fallbackTriggered: boolean;
    fallbackAttempts: number;
    fallbackFoundOn?: string;
  };
}

interface DispatchOptions {
  dryRun?: boolean;
  from?: string;
  to?: string;
  now?: Date;
  // TEMP(csat-test): quando true, se a janela default não tiver feedbacks,
  // o dispatcher anda pra trás até achar um dia com feedbacks. Remover junto
  // com o bloco marcado abaixo quando terminar a validação manual.
  fallbackToLastDayWithFeedbacks?: boolean;
}

// TEMP(csat-test): limite de dias que o fallback anda pra trás procurando
// um dia com feedbacks. Evita varredura infinita.
const FALLBACK_MAX_DAYS_BACK = 30;

function emptyResult(dryRun: boolean, message?: string): DispatchResult {
  return {
    dryRun,
    dateCovered: null,
    summary: { total: 0, withComment: 0, withoutComment: 0, averageStars: 0, byStars: {} },
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

  // Config from Tools (channel + enabled)
  const config = await getCsatReviewsConfig();
  const enabled = config?.enabled ?? false;
  const slackChannelId = config?.slackChannelId || '';

  if (!dryRun && !enabled) {
    return emptyResult(dryRun, 'Envio automático desativado nas configurações do Tools.');
  }
  if (!dryRun && !slackChannelId) {
    return emptyResult(dryRun, 'Canal Slack não configurado nas configurações do Tools.');
  }

  // TEMP(csat-test): rastreio do fallback.
  const debug = {
    metabaseKeyConfigured: !!process.env.METABASE_API_KEY,
    fallbackTriggered: false,
    fallbackAttempts: 0,
    fallbackFoundOn: undefined as string | undefined,
  };

  // Busca feedbacks no Metabase
  let allFeedbacks = await fetchMetabaseFeedbacks({ from, to });

  // TEMP(csat-test): fallback p/ último dia útil com feedbacks.
  // Só dispara quando a janela default veio vazia, sem override manual de
  // from/to e com a flag explicitamente ativa (route /dispatch da API).
  // Remover este bloco quando terminar a validação manual.
  if (
    allFeedbacks.length === 0 &&
    opts.fallbackToLastDayWithFeedbacks &&
    !opts.from &&
    !opts.to
  ) {
    debug.fallbackTriggered = true;
    let cursor = new Date(from);
    cursor.setDate(cursor.getDate() - 1);
    for (let i = 0; i < FALLBACK_MAX_DAYS_BACK; i++) {
      debug.fallbackAttempts++;
      const trialFrom = new Date(cursor);
      trialFrom.setHours(0, 0, 0, 0);
      const trialTo = new Date(cursor);
      trialTo.setHours(23, 59, 59, 999);
      const trial = await fetchMetabaseFeedbacks({ from: trialFrom, to: trialTo });
      if (trial.length > 0) {
        allFeedbacks = trial;
        from = trialFrom;
        to = trialTo;
        label = formatBR(trialFrom);
        debug.fallbackFoundOn = label;
        console.log(
          `[csat-reviews] fallback ativo: usando ${label} (${i + 1} dia(s) atrás da janela default)`
        );
        break;
      }
      cursor.setDate(cursor.getDate() - 1);
    }
  }

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
      _debug: debug,
    };
  }

  if (dryRun) {
    return {
      dryRun: true,
      dateCovered: label,
      summary,
      feedbacks: commented,
      _debug: debug,
    };
  }

  // Cria thread no Slack: mensagem-pai (resumo) + replies (um por feedback).
  // Cada execução do dispatcher cria uma thread nova (postParent gera um novo ts).
  const isSingleDay = from.toDateString() === to.toDateString();
  const threadTitle = isSingleDay
    ? `*Feedbacks - dia ${formatBR(from)}*`
    : `*Feedbacks - ${formatBR(from)} a ${formatBR(to)}*`;

  const parentText = [
    threadTitle,
    '',
    summaryMessage({ dateLabel: label, summary }),
  ].join('\n');

  const parentTs = await slackPublisher.postParent(slackChannelId, parentText);
  if (!parentTs) {
    return {
      ...emptyResult(dryRun, 'Falha ao criar a mensagem-pai no Slack.'),
      dateCovered: label,
    };
  }

  for (const f of commented) {
    try {
      await slackPublisher.postReply(slackChannelId, parentTs, formatFeedbackMessage(f));
    } catch (err) {
      console.error('[csat-reviews] failed to post reply:', err);
    }
  }

  return {
    dryRun: false,
    dateCovered: label,
    summary,
    feedbacks: commented,
    _debug: debug,
  };
}
