// Canal hardcoded enquanto a env `SLACK_BUG_REPORTS_CHANNEL_ID` nao for
// adicionada ao secret do K8s. Channel ID nao e segredo (qualquer membro
// do workspace ve no menu do canal) entao pode viver no codigo. Se a env
// existir, ela tem prioridade pra permitir override em outro ambiente.
const HARDCODED_CHANNEL_ID = 'C0B71GB2ZPS';

export const SLACK_REPORTS_CONFIG = {
  /** Canal do Slack onde o time abre bug reports. */
  channelId: process.env.SLACK_BUG_REPORTS_CHANNEL_ID || HARDCODED_CHANNEL_ID,
  /** Signing secret pra verificar webhooks do Slack. Quando ausente, o
   * bot aceita os webhooks SEM verificar assinatura — modo testes
   * permitido temporariamente em ambientes onde a env ainda nao foi
   * adicionada ao secret. Veja a regra em `routes.ts`. */
  signingSecret: process.env.SLACK_SIGNING_SECRET || '',
  /** Quantos segundos esperar depois da primeira reply pra processar a
   * thread. Da ao usuario tempo de mandar o conteudo completo antes do
   * bot rodar RAG. */
  threadDebounceMs: 15_000,
  /** Reaction de resolucao na mensagem-pai (sem `:`). */
  resolutionReaction: 'white_check_mark',
} as const;
