import prisma from '../../../services/prisma';
import { withRetry } from '../utils/retry';

interface RecordVoiceEventData {
  guildId: string;
  userId: string;
  channelId?: string | null;
  channelName?: string | null;
  eventType: string;
  sessionId?: string | null;
}

export async function startVoiceSession(
  guildId: string,
  userId: string,
  discordSessionId: string,
  channelId: string,
): Promise<void> {
  await withRetry(async () => {
    await prisma.metricsActiveVoiceSession.upsert({
      where: {
        guildId_userId_discordSessionId: { guildId, userId, discordSessionId },
      },
      create: {
        guildId,
        userId,
        discordSessionId,
        channelId,
        joinTimestamp: new Date(),
      },
      update: {
        channelId,
        joinTimestamp: new Date(),
      },
    });
  });
}

export async function endVoiceSession(
  guildId: string,
  userId: string,
  discordSessionId: string,
): Promise<{ durationSeconds: number; channelId: string } | null> {
  return prisma.$transaction(async (tx) => {
    const session = await tx.metricsActiveVoiceSession.findUnique({
      where: {
        guildId_userId_discordSessionId: { guildId, userId, discordSessionId },
      },
    });

    if (!session) {
      return null;
    }

    await tx.metricsActiveVoiceSession.delete({
      where: {
        guildId_userId_discordSessionId: { guildId, userId, discordSessionId },
      },
    });

    const now = new Date();
    const durationSeconds = Math.max(
      0,
      Math.floor((now.getTime() - session.joinTimestamp.getTime()) / 1000),
    );

    await tx.metricsCompletedVoiceSession.create({
      data: {
        guildId,
        userId,
        channelId: session.channelId,
        discordSessionId,
        joinTimestamp: session.joinTimestamp,
        leaveTimestamp: now,
        durationSeconds,
      },
    });

    return { durationSeconds, channelId: session.channelId };
  });
}

export async function moveVoiceChannel(
  guildId: string,
  userId: string,
  discordSessionId: string,
  newChannelId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const session = await tx.metricsActiveVoiceSession.findUnique({
      where: {
        guildId_userId_discordSessionId: { guildId, userId, discordSessionId },
      },
    });

    if (session) {
      await tx.metricsActiveVoiceSession.delete({
        where: {
          guildId_userId_discordSessionId: { guildId, userId, discordSessionId },
        },
      });

      const now = new Date();
      const durationSeconds = Math.max(
        0,
        Math.floor((now.getTime() - session.joinTimestamp.getTime()) / 1000),
      );

      await tx.metricsCompletedVoiceSession.create({
        data: {
          guildId,
          userId,
          channelId: session.channelId,
          discordSessionId,
          joinTimestamp: session.joinTimestamp,
          leaveTimestamp: now,
          durationSeconds,
        },
      });
    }

    await tx.metricsActiveVoiceSession.create({
      data: {
        guildId,
        userId,
        discordSessionId,
        channelId: newChannelId,
        joinTimestamp: new Date(),
      },
    });
  });
}

export async function recordVoiceEvent(data: RecordVoiceEventData): Promise<void> {
  await withRetry(async () => {
    await prisma.metricsVoiceEvent.create({
      data: {
        guildId: data.guildId,
        userId: data.userId,
        channelId: data.channelId ?? null,
        channelName: data.channelName ?? null,
        eventType: data.eventType,
        sessionId: data.sessionId ?? null,
      },
    });
  });
}

export async function cleanupOrphanedSessions(): Promise<number> {
  const sessions = await prisma.metricsActiveVoiceSession.findMany();

  if (sessions.length === 0) {
    return 0;
  }

  const now = new Date();

  for (const session of sessions) {
    const durationSeconds = Math.max(
      0,
      Math.floor((now.getTime() - session.joinTimestamp.getTime()) / 1000),
    );

    await prisma.$transaction(async (tx) => {
      await tx.metricsActiveVoiceSession.delete({
        where: {
          guildId_userId_discordSessionId: {
            guildId: session.guildId,
            userId: session.userId,
            discordSessionId: session.discordSessionId,
          },
        },
      });

      await tx.metricsCompletedVoiceSession.create({
        data: {
          guildId: session.guildId,
          userId: session.userId,
          channelId: session.channelId,
          discordSessionId: session.discordSessionId,
          joinTimestamp: session.joinTimestamp,
          leaveTimestamp: now,
          durationSeconds,
        },
      });
    });
  }

  console.log(`[Metrics] Cleaned up ${sessions.length} orphaned voice sessions`);
  return sessions.length;
}

export async function closeAllActiveSessions(): Promise<number> {
  return cleanupOrphanedSessions();
}
