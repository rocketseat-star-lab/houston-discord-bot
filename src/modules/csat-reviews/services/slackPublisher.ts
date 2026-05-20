import { WebClient } from '@slack/web-api';

let client: WebClient | null = null;

function getClient(): WebClient | null {
  if (client) return client;
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.warn('[csat-reviews] SLACK_BOT_TOKEN ausente.');
    return null;
  }
  client = new WebClient(token);
  return client;
}

export const slackPublisher = {
  /**
   * Posta uma mensagem-pai no canal (a "thread" começa aqui).
   * Retorna o `ts` da mensagem pra postar replies depois.
   */
  async postParent(channel: string, text: string): Promise<string | null> {
    const c = getClient();
    if (!c) return null;
    const res = await c.chat.postMessage({
      channel,
      text,
      mrkdwn: true,
      unfurl_links: false,
      unfurl_media: false,
    });
    return (res.ts as string) || null;
  },

  /**
   * Posta uma reply dentro da thread iniciada por `threadTs`.
   */
  async postReply(channel: string, threadTs: string, text: string): Promise<void> {
    const c = getClient();
    if (!c) return;
    await c.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text,
      mrkdwn: true,
      unfurl_links: false,
      unfurl_media: false,
    });
  },
};
