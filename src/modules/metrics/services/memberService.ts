import { Guild } from 'discord.js';
import prisma from '../../../services/prisma';
import { withRetry } from '../utils/retry';

export function getDisplayName(username: string, discriminator?: string | null): string {
  if (discriminator && discriminator !== '0') {
    return `${username}#${discriminator}`;
  }
  return username;
}

export async function ensureMemberExists(
  guildId: string,
  userId: string,
  username: string,
  discriminator?: string | null,
  isBot?: boolean,
  joinedAt?: Date,
  nickname?: string | null,
): Promise<void> {
  await withRetry(async () => {
    const existing = await prisma.metricsMember.findUnique({
      where: { guildId_userId: { guildId, userId } },
      select: { isActive: true },
    });

    const now = joinedAt ?? new Date();

    if (!existing) {
      await prisma.metricsMember.create({
        data: {
          guildId,
          userId,
          username,
          discriminator: discriminator ?? null,
          isBot: isBot ?? false,
          joinedAt: now,
          isActive: true,
          nickname: nickname ?? null,
        },
      });
      return;
    }

    await prisma.metricsMember.update({
      where: { guildId_userId: { guildId, userId } },
      data: {
        username,
        discriminator: discriminator ?? null,
        nickname: nickname ?? null,
        isActive: true,
        ...(existing.isActive === false ? { joinedAt: now } : {}),
      },
    });
  });
}

export async function markMemberLeft(guildId: string, userId: string): Promise<void> {
  await withRetry(async () => {
    await prisma.metricsMember.updateMany({
      where: { guildId, userId, isActive: true },
      data: { isActive: false, leftAt: new Date() },
    });
  });
}

export async function recordJoinEvent(guildId: string, userId: string): Promise<void> {
  await prisma.metricsJoinLeaveEvent.create({
    data: { guildId, userId, eventType: 'join' },
  });
}

export async function recordLeaveEvent(guildId: string, userId: string): Promise<void> {
  await prisma.metricsJoinLeaveEvent.create({
    data: { guildId, userId, eventType: 'leave' },
  });
}

const BATCH_SIZE = 750;

export async function processExistingMembers(guild: Guild): Promise<void> {
  console.log(`[Metrics] Fetching all members for guild ${guild.name} (${guild.id})...`);

  const members = await guild.members.fetch();
  const memberArray = [...members.values()];
  const total = memberArray.length;

  console.log(`[Metrics] Processing ${total} members in batches of ${BATCH_SIZE}...`);

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = memberArray.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map((member) =>
        ensureMemberExists(
          guild.id,
          member.user.id,
          member.user.username,
          member.user.discriminator,
          member.user.bot,
          member.joinedAt ?? new Date(),
          member.nickname,
        ),
      ),
    );

    const processed = Math.min(i + BATCH_SIZE, total);
    console.log(`[Metrics] Processed ${processed}/${total} members`);
  }

  console.log(`[Metrics] Finished processing all ${total} members for guild ${guild.name}`);
}
