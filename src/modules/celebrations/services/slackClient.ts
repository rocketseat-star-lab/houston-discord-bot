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
   * Posts a message in the configured channel. Image URLs are appended
   * as plain links — Slack unfurls them asynchronously, which is more
   * tolerant of slow image generators (cold starts, etc) than using
   * `image` blocks (which Slack tries to fetch synchronously before
   * the message is delivered and gives up quickly).
   */
  async postMessage(opts: { channel: string; text: string; imageUrls?: string[] }): Promise<void> {
    const c = getClient();
    if (!c) throw new Error('Slack client não configurado.');

    const lines = [opts.text];
    for (const url of opts.imageUrls || []) {
      lines.push(url);
    }

    await c.chat.postMessage({
      channel: opts.channel,
      text: lines.join('\n'),
      unfurl_links: true,
      unfurl_media: true,
    });
  },
};
