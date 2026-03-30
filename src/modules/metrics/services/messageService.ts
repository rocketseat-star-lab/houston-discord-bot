import prisma from '../../../services/prisma';
import { withRetry } from '../utils/retry';

interface RecordMessageData {
  messageId: string;
  guildId: string;
  userId: string;
  channelId: string;
  channelName?: string | null;
  categoryName?: string | null;
  contentLength?: number | null;
  hasEmbed: boolean;
  hasAttachment: boolean;
  createdAt: Date;
}

export async function recordMessage(data: RecordMessageData): Promise<void> {
  await withRetry(async () => {
    await prisma.metricsMessageEvent.upsert({
      where: { messageId: data.messageId },
      create: {
        messageId: data.messageId,
        guildId: data.guildId,
        userId: data.userId,
        channelId: data.channelId,
        channelName: data.channelName ?? null,
        categoryName: data.categoryName ?? null,
        contentLength: data.contentLength ?? null,
        hasEmbed: data.hasEmbed,
        hasAttachment: data.hasAttachment,
        createdAt: data.createdAt,
      },
      update: {},
    });
  });
}
