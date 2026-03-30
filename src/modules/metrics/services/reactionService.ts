import prisma from '../../../services/prisma';
import { withRetry } from '../utils/retry';

interface RecordReactionData {
  messageId: string;
  guildId: string;
  userId: string;
  channelId: string;
  emoji: string;
  eventType: 'added' | 'removed';
}

export async function recordReaction(data: RecordReactionData): Promise<void> {
  await withRetry(async () => {
    await prisma.metricsReactionEvent.create({
      data: {
        messageId: data.messageId,
        guildId: data.guildId,
        userId: data.userId,
        channelId: data.channelId,
        emoji: data.emoji,
        eventType: data.eventType,
      },
    });
  });
}
