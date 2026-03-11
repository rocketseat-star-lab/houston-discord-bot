import { ThreadChannel } from "discord.js";

export interface ThreadContent {
  title: string;
  description: string;
}

export async function extractThreadContent(
  thread: ThreadChannel
): Promise<ThreadContent> {
  const title = thread.name;
  // Fetch the first messages in the thread
  const messages = await thread.messages.fetch({ limit: 10, after: "0" });
  // Find the first user message (skip system messages)
  const firstMessage = messages
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
    .find(msg => !msg.system);
  return {
    title,
    description: firstMessage?.content || "",
  };
}

export function combineForEmbedding(
  title: string,
  description: string
): string {
  return `${title}\n\n${description}`;
}

export function combineForEmbeddingSummary(
  title: string,
  summary: string
): string {
  return `${title}\n\n${summary}`;
}
