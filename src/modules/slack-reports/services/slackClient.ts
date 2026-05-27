import { WebClient } from '@slack/web-api';

let client: WebClient | null = null;

function getClient(): WebClient {
  if (client) return client;
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    throw new Error('[slack-reports] SLACK_BOT_TOKEN ausente.');
  }
  client = new WebClient(token);
  return client;
}

export interface ThreadMessage {
  ts: string;
  user?: string;
  text: string;
  isBot: boolean;
}

export interface ThreadContent {
  parent: ThreadMessage;
  replies: ThreadMessage[];
}

/**
 * Busca conteudo completo de uma thread no Slack: mensagem-pai + todas as
 * replies, ja filtrando mensagens do proprio bot.
 */
export async function fetchSlackThread(
  channel: string,
  threadTs: string
): Promise<ThreadContent | null> {
  const c = getClient();
  const res = await c.conversations.replies({ channel, ts: threadTs, limit: 200 });
  const messages = res.messages ?? [];
  if (messages.length === 0) return null;

  const [parentRaw, ...repliesRaw] = messages;
  const toThreadMessage = (m: any): ThreadMessage => ({
    ts: String(m.ts),
    user: m.user,
    text: typeof m.text === 'string' ? m.text : '',
    isBot: !!m.bot_id || m.subtype === 'bot_message',
  });

  return {
    parent: toThreadMessage(parentRaw),
    replies: repliesRaw.map(toThreadMessage),
  };
}

export async function postInThread(opts: {
  channel: string;
  threadTs: string;
  text: string;
  blocks?: any[];
}): Promise<void> {
  await getClient().chat.postMessage({
    channel: opts.channel,
    thread_ts: opts.threadTs,
    text: opts.text,
    blocks: opts.blocks,
    unfurl_links: false,
    unfurl_media: false,
  });
}

export async function addReaction(opts: {
  channel: string;
  timestamp: string;
  name: string;
}): Promise<void> {
  try {
    await getClient().reactions.add({
      channel: opts.channel,
      timestamp: opts.timestamp,
      name: opts.name,
    });
  } catch (err: any) {
    // already_reacted nao e erro real.
    if (err?.data?.error !== 'already_reacted') {
      console.error('[slack-reports] addReaction error:', err?.data ?? err);
    }
  }
}

export async function getPermalink(opts: {
  channel: string;
  messageTs: string;
}): Promise<string | null> {
  try {
    const r = await getClient().chat.getPermalink({
      channel: opts.channel,
      message_ts: opts.messageTs,
    });
    return (r.permalink as string) || null;
  } catch (err: any) {
    console.error('[slack-reports] getPermalink error:', err?.data ?? err);
    return null;
  }
}

/**
 * Atualiza uma mensagem ja postada pelo bot. Usado pra editar o card de
 * similares depois que o usuario clica num botao.
 */
export async function updateMessage(opts: {
  channel: string;
  ts: string;
  text: string;
  blocks?: any[];
}): Promise<void> {
  await getClient().chat.update({
    channel: opts.channel,
    ts: opts.ts,
    text: opts.text,
    blocks: opts.blocks,
  });
}
