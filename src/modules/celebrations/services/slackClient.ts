import { WebClient } from '@slack/web-api';

let client: WebClient | null = null;

function getClient(): WebClient | null {
  if (client) return client;
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.warn('[celebrations] SLACK_BOT_TOKEN ausente.');
    return null;
  }
  client = new WebClient(token);
  return client;
}

export const slackClient = {
  /**
   * Resolves Slack user ID from an email. Returns null if not found.
   */
  async lookupUserIdByEmail(email: string): Promise<string | null> {
    const c = getClient();
    if (!c) return null;
    try {
      const result = await c.users.lookupByEmail({ email });
      return result.user?.id || null;
    } catch (err: any) {
      if (err?.data?.error === 'users_not_found') return null;
      console.error(`[celebrations] lookupUserIdByEmail("${email}") failed:`, err?.data || err);
      return null;
    }
  },

  /**
   * Gets the user's profile image (largest available).
   */
  async getUserImageUrl(slackUserId: string): Promise<string | null> {
    const c = getClient();
    if (!c) return null;
    try {
      const result = await c.users.info({ user: slackUserId });
      const profile = (result.user as { profile?: Record<string, string | undefined> } | undefined)?.profile;
      return (
        profile?.image_original ||
        profile?.image_512 ||
        profile?.image_192 ||
        profile?.image_72 ||
        null
      );
    } catch (err: any) {
      console.error(`[celebrations] getUserImageUrl("${slackUserId}") failed:`, err?.data || err);
      return null;
    }
  },

  /**
   * Posts a message in the configured channel. `attachmentUrls` are appended
   * as plain links so Slack will unfurl them as images.
   */
  async postMessage(opts: { channel: string; text: string; imageUrls?: string[] }): Promise<void> {
    const c = getClient();
    if (!c) throw new Error('Slack client não configurado.');

    const blocks: Array<Record<string, unknown>> = [
      { type: 'section', text: { type: 'mrkdwn', text: opts.text } },
    ];
    for (const url of opts.imageUrls || []) {
      blocks.push({
        type: 'image',
        image_url: url,
        alt_text: 'Celebração Rocketseat',
      });
    }

    await c.chat.postMessage({
      channel: opts.channel,
      text: opts.text,
      blocks: blocks as never,
      unfurl_links: true,
      unfurl_media: true,
    });
  },
};
