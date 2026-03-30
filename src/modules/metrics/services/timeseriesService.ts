import prisma from '../../../services/prisma';
import { addDays } from 'date-fns';

function bucketByDay(events: { createdAt: Date }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const event of events) {
    const key = event.createdAt.toISOString().split('T')[0];
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}

function generateDateRange(from: Date, to: Date): string[] {
  const dates: string[] = [];
  let current = new Date(from);
  while (current < to) {
    dates.push(current.toISOString().split('T')[0]);
    current = addDays(current, 1);
  }
  return dates;
}

export async function getDailyMemberActivity(
  guildId: string,
  from: Date,
  to: Date,
): Promise<{ date: string; joins: number; leaves: number }[]> {
  const [joinEvents, leaveEvents] = await Promise.all([
    prisma.metricsJoinLeaveEvent.findMany({
      where: { guildId, eventType: 'join', createdAt: { gte: from, lt: to } },
      select: { createdAt: true },
    }),
    prisma.metricsJoinLeaveEvent.findMany({
      where: { guildId, eventType: 'leave', createdAt: { gte: from, lt: to } },
      select: { createdAt: true },
    }),
  ]);

  const joinsByDay = bucketByDay(joinEvents);
  const leavesByDay = bucketByDay(leaveEvents);
  const dates = generateDateRange(from, to);

  return dates.map((date) => ({
    date,
    joins: joinsByDay.get(date) || 0,
    leaves: leavesByDay.get(date) || 0,
  }));
}

export async function getDailyMessageActivity(
  guildId: string,
  from: Date,
  to: Date,
): Promise<{ date: string; count: number }[]> {
  const events = await prisma.metricsMessageEvent.findMany({
    where: { guildId, createdAt: { gte: from, lt: to } },
    select: { createdAt: true },
  });

  const countByDay = bucketByDay(events);
  const dates = generateDateRange(from, to);

  return dates.map((date) => ({
    date,
    count: countByDay.get(date) || 0,
  }));
}

export async function getDailyReactionActivity(
  guildId: string,
  from: Date,
  to: Date,
): Promise<{ date: string; added: number; removed: number }[]> {
  const [addedEvents, removedEvents] = await Promise.all([
    prisma.metricsReactionEvent.findMany({
      where: { guildId, eventType: 'add', createdAt: { gte: from, lt: to } },
      select: { createdAt: true },
    }),
    prisma.metricsReactionEvent.findMany({
      where: { guildId, eventType: 'remove', createdAt: { gte: from, lt: to } },
      select: { createdAt: true },
    }),
  ]);

  const addedByDay = bucketByDay(addedEvents);
  const removedByDay = bucketByDay(removedEvents);
  const dates = generateDateRange(from, to);

  return dates.map((date) => ({
    date,
    added: addedByDay.get(date) || 0,
    removed: removedByDay.get(date) || 0,
  }));
}

export async function getDailyVoiceActivity(
  guildId: string,
  from: Date,
  to: Date,
): Promise<{ date: string; totalSeconds: number; sessionCount: number }[]> {
  const sessions = await prisma.metricsCompletedVoiceSession.findMany({
    where: { guildId, leaveTimestamp: { gte: from, lt: to } },
    select: { leaveTimestamp: true, durationSeconds: true },
  });

  const secondsByDay = new Map<string, number>();
  const countByDay = new Map<string, number>();

  for (const session of sessions) {
    const key = session.leaveTimestamp.toISOString().split('T')[0];
    secondsByDay.set(key, (secondsByDay.get(key) || 0) + session.durationSeconds);
    countByDay.set(key, (countByDay.get(key) || 0) + 1);
  }

  const dates = generateDateRange(from, to);

  return dates.map((date) => ({
    date,
    totalSeconds: secondsByDay.get(date) || 0,
    sessionCount: countByDay.get(date) || 0,
  }));
}

export async function getTopChannels(
  guildId: string,
  from: Date,
  to: Date,
  limit: number,
): Promise<{ channelId: string; channelName: string | null; count: number }[]> {
  const grouped = await prisma.metricsMessageEvent.groupBy({
    by: ['channelId'],
    where: { guildId, createdAt: { gte: from, lt: to } },
    _count: { channelId: true },
    orderBy: { _count: { channelId: 'desc' } },
    take: limit,
  });

  const channelIds = grouped.map((g) => g.channelId);
  const channelNames = await prisma.metricsMessageEvent.findMany({
    where: { channelId: { in: channelIds } },
    select: { channelId: true, channelName: true },
    distinct: ['channelId'],
  });
  const nameMap = new Map(channelNames.map((c) => [c.channelId, c.channelName]));

  return grouped.map((g) => ({
    channelId: g.channelId,
    channelName: nameMap.get(g.channelId) || null,
    count: g._count.channelId,
  }));
}

export async function getTopVoiceChannels(
  guildId: string,
  from: Date,
  to: Date,
  limit: number,
): Promise<{ channelId: string; channelName: string | null; totalSeconds: number }[]> {
  const grouped = await prisma.metricsCompletedVoiceSession.groupBy({
    by: ['channelId'],
    where: { guildId, leaveTimestamp: { gte: from, lt: to } },
    _sum: { durationSeconds: true },
    orderBy: { _sum: { durationSeconds: 'desc' } },
    take: limit,
  });

  const channelIds = grouped.map((g) => g.channelId);
  const channelNames = await prisma.metricsVoiceEvent.findMany({
    where: { channelId: { in: channelIds } },
    select: { channelId: true, channelName: true },
    distinct: ['channelId'],
  });
  const nameMap = new Map(
    channelNames.map((c) => [c.channelId, c.channelName]),
  );

  return grouped.map((g) => ({
    channelId: g.channelId,
    channelName: nameMap.get(g.channelId) || null,
    totalSeconds: g._sum.durationSeconds || 0,
  }));
}

export async function getMemberRetentionDistribution(
  guildId: string,
): Promise<{ bucket: string; count: number }[]> {
  const leavers = await prisma.metricsMember.findMany({
    where: { guildId, isActive: false, leftAt: { not: null } },
    select: { joinedAt: true, leftAt: true },
  });

  const buckets = new Map<string, number>([
    ['< 7 dias', 0],
    ['7-14 dias', 0],
    ['15-29 dias', 0],
    ['1-2 meses', 0],
    ['3-5 meses', 0],
    ['6-11 meses', 0],
    ['1+ ano', 0],
  ]);

  for (const member of leavers) {
    const stayDays = Math.floor(
      (member.leftAt!.getTime() - member.joinedAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    let bucket: string;
    if (stayDays < 7) {
      bucket = '< 7 dias';
    } else if (stayDays <= 14) {
      bucket = '7-14 dias';
    } else if (stayDays <= 29) {
      bucket = '15-29 dias';
    } else if (stayDays <= 60) {
      bucket = '1-2 meses';
    } else if (stayDays <= 150) {
      bucket = '3-5 meses';
    } else if (stayDays <= 330) {
      bucket = '6-11 meses';
    } else {
      bucket = '1+ ano';
    }

    buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
  }

  return Array.from(buckets.entries()).map(([bucket, count]) => ({
    bucket,
    count,
  }));
}

export async function getTotalMemberCount(
  guildId: string,
): Promise<{ total: number; active: number; inactive: number; bots: number }> {
  const [total, active, inactive, bots] = await Promise.all([
    prisma.metricsMember.count({ where: { guildId } }),
    prisma.metricsMember.count({ where: { guildId, isActive: true, isBot: false } }),
    prisma.metricsMember.count({ where: { guildId, isActive: false } }),
    prisma.metricsMember.count({ where: { guildId, isBot: true } }),
  ]);

  return { total, active, inactive, bots };
}
