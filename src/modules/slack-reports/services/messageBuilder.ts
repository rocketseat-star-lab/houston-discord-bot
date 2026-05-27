import type { SimilarReport } from '../../../services/reports/embeddingService';

const MAX_SIMILARS_DISPLAYED = 3;

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
      ],
    },
  ];

  return {
    text: 'Encontrei reports similares ao seu problema.',
    blocks,
  };
}

export function buildNoSimilarReportsMessage(): { text: string; blocks: any[] } {
  return {
    text: 'Não encontrei reports similares — descreva seu problema com detalhes.',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Nenhum report similar encontrado.*\n\nContinue descrevendo seu relatório com detalhes pra que a equipe possa ajudar melhor. Quanto mais informações você fornecer, mais rápida será a resolução.\n\nQuando o problema for resolvido, reaja com :white_check_mark: na mensagem principal pra eu documentar.',
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
