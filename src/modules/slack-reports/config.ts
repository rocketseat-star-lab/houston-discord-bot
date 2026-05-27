export const SLACK_REPORTS_CONFIG = {
  /** Canal do Slack onde o time abre bug reports. */
  channelId: process.env.SLACK_BUG_REPORTS_CHANNEL_ID || '',
  /** Signing secret pra verificar webhooks do Slack. */
  signingSecret: process.env.SLACK_SIGNING_SECRET || '',
  /** Quantos segundos esperar depois da primeira reply pra processar a
   * thread. Da ao usuario tempo de mandar o conteudo completo antes do
   * bot rodar RAG. */
  threadDebounceMs: 15_000,
  /** Reaction de resolucao na mensagem-pai (sem `:`). */
  resolutionReaction: 'white_check_mark',
} as const;
