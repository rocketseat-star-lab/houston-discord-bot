import type { SimilarReport } from '../../../services/reports/embeddingService';

const MAX_SIMILARS_DISPLAYED = 3;

/**
 * Block de botao "Marcar como resolvido" — vai pro card de sugestao de
 * similares (junto com Sim/Nao) e tambem pro card de "nenhum similar".
 * Quando clicado, dispara `slack_report_mark_resolved` no handler de
 * interactivity.
 */
function markResolvedButton(actionValue: string) {
  return {
    type: 'button',
    action_id: 'slack_report_mark_resolved',
    text: { type: 'plain_text', text: 'Marcar como resolvido', emoji: false },
    style: 'primary',
    value: actionValue,
  };
}

/**
 * Renderiza a data no formato pt-BR usando o token nativo de data do
 * Slack — assim cada usuario ve no proprio fuso. Fallback explicito
 * pra clientes sem renderizacao de tokens.
 */
function formatSlackDate(d: Date, fallback: string): string {
  const unix = Math.floor(d.getTime() / 1000);
  return `<!date^${unix}^{date_short_pretty} às {time}|${fallback}>`;
}

function formatFallback(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} às ${hh}:${min} UTC`;
}

/**
 * Monta os blocks (Slack Block Kit) pra mensagem de "Reports similares
 * encontrados" — header + lista de top 3 com links + botoes Sim/Nao.
 *
 * `actionContext` vai serializado no `value` dos botoes pra o handler
 * de interaction conseguir reagir na thread certa sem ter que persistir
 * estado: contem channel + thread_ts.
 */
export function buildSimilarReportsMessage(opts: {
  reports: SimilarReport[];
  permalinks: Map<bigint, string | null>;
  threadChannel: string;
  threadTs: string;
}): { text: string; blocks: any[] } {
  const top = opts.reports.slice(0, MAX_SIMILARS_DISPLAYED);
  const lines = top.map((r, i) => {
    const status = r.solution ? ':white_check_mark: Resolvido' : ':hourglass_flowing_sand: Em aberto';
    const percent = Math.round(r.similarity * 100);
    const link = opts.permalinks.get(r.id);
    const linkText = link ? `<${link}|Ver thread>` : '_(link indisponível)_';
    return `${i + 1}. *${escapeText(r.title)}* (${percent}% similar)\n   ${status} — ${linkText}`;
  });

  const actionValue = JSON.stringify({
    channel: opts.threadChannel,
    threadTs: opts.threadTs,
  });

  const blocks: any[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'Reports similares encontrados', emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Encontrei reports que podem ajudar com seu problema:',
      },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: lines.join('\n\n') },
    },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: 'Algum desses resolve o seu problema?' },
      ],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          action_id: 'slack_report_similar_yes',
          text: { type: 'plain_text', text: 'Sim, resolveu!' },
          style: 'primary',
          value: actionValue,
        },
        {
          type: 'button',
          action_id: 'slack_report_similar_no',
          text: { type: 'plain_text', text: 'Não, ainda preciso de ajuda' },
          style: 'danger',
          value: actionValue,
        },
        markResolvedButton(actionValue),
      ],
    },
  ];

  return {
    text: 'Encontrei reports similares ao seu problema.',
    blocks,
  };
}

export function buildNoSimilarReportsMessage(actionValue: string): { text: string; blocks: any[] } {
  return {
    text: 'Não encontrei reports similares — descreva seu problema com detalhes.',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Nenhum report similar encontrado.*\n\nContinue descrevendo seu relatório com detalhes pra que a equipe possa ajudar melhor. Quanto mais informações você fornecer, mais rápida será a resolução.\n\nQuando o problema for resolvido, clica no botão abaixo pra eu documentar.',
        },
      },
      {
        type: 'actions',
        elements: [markResolvedButton(actionValue)],
      },
    ],
  };
}

/**
 * Substitui o card original na thread depois que alguem clicou "Marcar
 * como resolvido". Sem botoes — registra quem fechou e quando.
 */
export function buildResolvedCard(opts: {
  resolvedByUserId: string;
  resolvedAt: Date;
}): { text: string; blocks: any[] } {
  const dateStr = formatSlackDate(opts.resolvedAt, formatFallback(opts.resolvedAt));
  return {
    text: 'Marcado como resolvido.',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:white_check_mark: *Resolvido* em ${dateStr} por <@${opts.resolvedByUserId}>. Já documentei pra futuras buscas.`,
        },
      },
    ],
  };
}

/**
 * Mensagem postada no canal (fora da thread) anunciando a resolucao
 * pra quem nao tava acompanhando. Linka pra thread via permalink.
 */
export function buildChannelResolvedNotification(opts: {
  resolvedByUserId: string;
  resolvedAt: Date;
  threadPermalink: string | null;
  reportTitle: string;
}): { text: string; blocks: any[] } {
  const dateStr = formatSlackDate(opts.resolvedAt, formatFallback(opts.resolvedAt));
  const safeTitle = escapeText(opts.reportTitle);
  const linkPart = opts.threadPermalink
    ? `<${opts.threadPermalink}|${safeTitle}>`
    : `*${safeTitle}*`;
  return {
    text: `Bug resolvido: ${opts.reportTitle}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:large_green_circle: *Bug resolvido* — ${linkPart}\n_Em ${dateStr} por <@${opts.resolvedByUserId}>._`,
        },
      },
    ],
  };
}

/**
 * Mensagem que substitui o card de similares depois que o usuario clica
 * "Sim, resolveu" — sem botoes, com um aviso de confirmacao.
 */
export function buildSimilarYesAcknowledged(): { text: string; blocks: any[] } {
  return {
    text: 'Ótimo! Marquei como resolvido via report anterior.',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':white_check_mark: *Ótimo!* Você indicou que um dos reports anteriores resolveu seu problema. Já registrei isso na thread.',
        },
      },
    ],
  };
}

/**
 * Mensagem que substitui o card de similares depois que o usuario clica
 * "Nao" — orienta a continuar descrevendo.
 */
export function buildSimilarNoAcknowledged(): { text: string; blocks: any[] } {
  return {
    text: 'Entendido. Continue descrevendo o problema.',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':information_source: Entendido. Continue descrevendo seu problema na thread — a equipe vai te ajudar. Quando resolver, reaja com :white_check_mark: na mensagem principal pra eu documentar.',
        },
      },
    ],
  };
}

function escapeText(s: string): string {
  // Slack mrkdwn escapa <, >, & em textos comuns. Title vem do usuario
  // entao precisa neutralizar pra nao virar mention/link acidental.
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
