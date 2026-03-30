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
  const [joinedMembers, leftMembers] = await Promise.all([
    prisma.metricsMember.findMany({
      where: { guildId, joinedAt: { gte: from, lt: to } },
      select: { joinedAt: true },
    }),
    prisma.metricsMember.findMany({
      where: { guildId, isActive: false, leftAt: { gte: from, lt: to } },
      select: { leftAt: true },
    }),
  ]);

  const joinsByDay = new Map<string, number>();
  for (const m of joinedMembers) {
    const key = m.joinedAt.toISOString().split('T')[0];
    joinsByDay.set(key, (joinsByDay.get(key) || 0) + 1);
  }

  const leavesByDay = new Map<string, number>();
  for (const m of leftMembers) {
    if (m.leftAt) {
      const key = m.leftAt.toISOString().split('T')[0];
      leavesByDay.set(key, (leavesByDay.get(key) || 0) + 1);
    }
  }

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
      where: { guildId, eventType: 'added', createdAt: { gte: from, lt: to } },
      select: { createdAt: true },
    }),
    prisma.metricsReactionEvent.findMany({
      where: { guildId, eventType: 'removed', createdAt: { gte: from, lt: to } },
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
): Promise<{ channelId: string; channelName: string | null; categoryName: string | null; count: number }[]> {
  const grouped = await prisma.metricsMessageEvent.groupBy({
    by: ['channelId'],
    where: { guildId, createdAt: { gte: from, lt: to } },
    _count: { channelId: true },
    orderBy: { _count: { channelId: 'desc' } },
    take: limit,
  });

  const channelIds = grouped.map((g) => g.channelId);
  const channelInfo = await prisma.metricsMessageEvent.findMany({
    where: { channelId: { in: channelIds } },
    select: { channelId: true, channelName: true, categoryName: true },
    distinct: ['channelId'],
  });
  const infoMap = new Map(channelInfo.map((c) => [c.channelId, { name: c.channelName, category: c.categoryName }]));

  return grouped.map((g) => ({
    channelId: g.channelId,
    channelName: infoMap.get(g.channelId)?.name || null,
    categoryName: infoMap.get(g.channelId)?.category || null,
    count: g._count.channelId,
  }));
}

export async function getTopVoiceChannels(
  guildId: string,
  from: Date,
  to: Date,
  limit: number,
): Promise<{ channelId: string; channelName: string | null; categoryName: string | null; totalSeconds: number }[]> {
  const grouped = await prisma.metricsCompletedVoiceSession.groupBy({
    by: ['channelId'],
    where: { guildId, leaveTimestamp: { gte: from, lt: to } },
    _sum: { durationSeconds: true },
    orderBy: { _sum: { durationSeconds: 'desc' } },
    take: limit,
  });

  const channelIds = grouped.map((g) => g.channelId);
  // Look up channel names from voice events, and category from message events
  const [voiceNames, msgInfo] = await Promise.all([
    prisma.metricsVoiceEvent.findMany({
      where: { channelId: { in: channelIds } },
      select: { channelId: true, channelName: true },
      distinct: ['channelId'],
    }),
    prisma.metricsMessageEvent.findMany({
      where: { channelId: { in: channelIds } },
      select: { channelId: true, categoryName: true },
      distinct: ['channelId'],
    }),
  ]);
  const nameMap = new Map(voiceNames.map((c) => [c.channelId, c.channelName]));
  const catMap = new Map(msgInfo.map((c) => [c.channelId, c.categoryName]));

  return grouped.map((g) => ({
    channelId: g.channelId,
    channelName: nameMap.get(g.channelId) || null,
    categoryName: catMap.get(g.channelId) || null,
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
): Promise<{ total: number; inServer: number; left: number; bots: number }> {
  const [total, inServer, left, bots] = await Promise.all([
    prisma.metricsMember.count({ where: { guildId } }),
    prisma.metricsMember.count({ where: { guildId, isActive: true, isBot: false } }),
    prisma.metricsMember.count({ where: { guildId, isActive: false } }),
    prisma.metricsMember.count({ where: { guildId, isBot: true } }),
  ]);

  return { total, inServer, left, bots };
}

export async function getActiveUsersByPeriod(
  guildId: string,
): Promise<{ last30d: number; last90d: number; last180d: number; last365d: number }> {
  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 86400000);
  const d90 = new Date(now.getTime() - 90 * 86400000);
  const d180 = new Date(now.getTime() - 180 * 86400000);
  const d365 = new Date(now.getTime() - 365 * 86400000);

  async function countActiveUsers(since: Date): Promise<number> {
    const [msgUsers, reactionUsers, voiceUsers] = await Promise.all([
      prisma.metricsMessageEvent.findMany({
        where: { guildId, createdAt: { gte: since } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      prisma.metricsReactionEvent.findMany({
        where: { guildId, createdAt: { gte: since } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      prisma.metricsCompletedVoiceSession.findMany({
        where: { guildId, leaveTimestamp: { gte: since } },
        select: { userId: true },
        distinct: ['userId'],
      }),
    ]);

    const uniqueIds = new Set<string>();
    for (const u of msgUsers) uniqueIds.add(u.userId);
    for (const u of reactionUsers) uniqueIds.add(u.userId);
    for (const u of voiceUsers) uniqueIds.add(u.userId);
    return uniqueIds.size;
  }

  const [last30d, last90d, last180d, last365d] = await Promise.all([
    countActiveUsers(d30),
    countActiveUsers(d90),
    countActiveUsers(d180),
    countActiveUsers(d365),
  ]);

  return { last30d, last90d, last180d, last365d };
}

export async function getDailyRetention(
  guildId: string,
  from: Date,
  to: Date,
): Promise<{ date: string; retained: number; left: number }[]> {
  const members = await prisma.metricsMember.findMany({
    where: { guildId, joinedAt: { gte: from, lt: to } },
    select: { joinedAt: true, isActive: true, leftAt: true },
  });

  const retainedByDay = new Map<string, number>();
  const leftByDay = new Map<string, number>();

  for (const m of members) {
    const key = m.joinedAt.toISOString().split('T')[0];
    if (m.isActive) {
      retainedByDay.set(key, (retainedByDay.get(key) || 0) + 1);
    } else {
      leftByDay.set(key, (leftByDay.get(key) || 0) + 1);
    }
  }

  const dates = generateDateRange(from, to);
  return dates.map((date) => ({
    date,
    retained: retainedByDay.get(date) || 0,
    left: leftByDay.get(date) || 0,
  }));
}

export async function getTopReactionChannels(
  guildId: string,
  from: Date,
  to: Date,
  limit: number,
): Promise<{ channelId: string; channelName: string | null; categoryName: string | null; count: number }[]> {
  const grouped = await prisma.metricsReactionEvent.groupBy({
    by: ['channelId'],
    where: { guildId, eventType: 'added', createdAt: { gte: from, lt: to } },
    _count: { channelId: true },
    orderBy: { _count: { channelId: 'desc' } },
    take: limit,
  });

  const channelIds = grouped.map((g) => g.channelId);
  const channelInfo = await prisma.metricsMessageEvent.findMany({
    where: { channelId: { in: channelIds } },
    select: { channelId: true, channelName: true, categoryName: true },
    distinct: ['channelId'],
  });
  const infoMap = new Map(channelInfo.map((c) => [c.channelId, { name: c.channelName, category: c.categoryName }]));

  return grouped.map((g) => ({
    channelId: g.channelId,
    channelName: infoMap.get(g.channelId)?.name || null,
    categoryName: infoMap.get(g.channelId)?.category || null,
    count: g._count.channelId,
  }));
}

export async function getTopMessageSenders(
  guildId: string,
  from: Date,
  to: Date,
  limit: number,
): Promise<{ userId: string; username: string; count: number }[]> {
  const grouped = await prisma.metricsMessageEvent.groupBy({
    by: ['userId'],
    where: { guildId, createdAt: { gte: from, lt: to } },
    _count: { userId: true },
    orderBy: { _count: { userId: 'desc' } },
    take: limit,
  });

  const userIds = grouped.map((g) => g.userId);
  const members = await prisma.metricsMember.findMany({
    where: { guildId, userId: { in: userIds } },
    select: { userId: true, username: true },
  });
  const nameMap = new Map(members.map((m) => [m.userId, m.username]));

  return grouped.map((g) => ({
    userId: g.userId,
    username: nameMap.get(g.userId) ?? g.userId,
    count: g._count.userId,
  }));
}

export async function getTopReactionUsers(
  guildId: string,
  from: Date,
  to: Date,
  limit: number,
): Promise<{ userId: string; username: string; count: number }[]> {
  const grouped = await prisma.metricsReactionEvent.groupBy({
    by: ['userId'],
    where: { guildId, eventType: 'added', createdAt: { gte: from, lt: to } },
    _count: { userId: true },
    orderBy: { _count: { userId: 'desc' } },
    take: limit,
  });

  const userIds = grouped.map((g) => g.userId);
  const members = await prisma.metricsMember.findMany({
    where: { guildId, userId: { in: userIds } },
    select: { userId: true, username: true },
  });
  const nameMap = new Map(members.map((m) => [m.userId, m.username]));

  return grouped.map((g) => ({
    userId: g.userId,
    username: nameMap.get(g.userId) ?? g.userId,
    count: g._count.userId,
  }));
}

export async function getTopVoiceUsers(
  guildId: string,
  from: Date,
  to: Date,
  limit: number,
): Promise<{ userId: string; username: string; totalSeconds: number }[]> {
  const grouped = await prisma.metricsCompletedVoiceSession.groupBy({
    by: ['userId'],
    where: { guildId, leaveTimestamp: { gte: from, lt: to } },
    _sum: { durationSeconds: true },
    orderBy: { _sum: { durationSeconds: 'desc' } },
    take: limit,
  });

  const userIds = grouped.map((g) => g.userId);
  const members = await prisma.metricsMember.findMany({
    where: { guildId, userId: { in: userIds } },
    select: { userId: true, username: true },
  });
  const nameMap = new Map(members.map((m) => [m.userId, m.username]));

  return grouped.map((g) => ({
    userId: g.userId,
    username: nameMap.get(g.userId) ?? g.userId,
    totalSeconds: g._sum.durationSeconds ?? 0,
  }));
}
