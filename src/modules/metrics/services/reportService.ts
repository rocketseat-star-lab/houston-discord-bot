import prisma from '../../../services/prisma';
import {
  getStartOfDayUTC,
  getEndOfDayUTC,
  getStartOfWeekUTC,
  getEndOfWeekUTC,
  getStartOfMonthUTC,
  getEndOfMonthUTC,
} from '../utils/dateUtils';
import { getDisplayName } from './memberService';

export interface LeaverStayStats {
  lt7Days: number;
  lt15Days: number;
  lt1Month: number;
  lt3Months: number;
  lt6Months: number;
  lt1Year: number;
  gte1Year: number;
  unknown: number;
  totalLeavers: number;
}

export interface TopUser {
  userId: string;
  username: string;
  count: number;
}

export interface MetricsReportData {
  guildId: string;
  periodStart: Date;
  periodEnd: Date;
  newMembers: number;
  leftMembersCount: number;
  memberBalance: number;
  leaverStayStats: LeaverStayStats;
  messageCount: number;
  reactionCount: number;
  totalVoiceTimeSeconds: number;
  topMessageSenders: TopUser[];
  topReactionUsers: TopUser[];
  topVoiceUsers: TopUser[];
}

async function resolveUsernames(
  guildId: string,
  userIds: string[],
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();

  const members = await prisma.metricsMember.findMany({
    where: { guildId, userId: { in: userIds } },
    select: { userId: true, username: true, discriminator: true },
  });

  const memberMap = new Map<string, string>();
  for (const m of members) {
    memberMap.set(m.userId, getDisplayName(m.username, m.discriminator));
  }

  return memberMap;
}

function bucketLeaverStayDays(days: number, stats: LeaverStayStats): void {
  if (days < 7) stats.lt7Days++;
  else if (days < 15) stats.lt15Days++;
  else if (days < 30) stats.lt1Month++;
  else if (days < 90) stats.lt3Months++;
  else if (days < 180) stats.lt6Months++;
  else if (days < 365) stats.lt1Year++;
  else stats.gte1Year++;
}

export async function generateReportData(
  guildId: string,
  periodStart: Date,
  periodEnd: Date,
  topN: number,
): Promise<MetricsReportData> {
  const dateRange = { gte: periodStart, lt: periodEnd };

  const [
    newMembers,
    leftMembersCount,
    leavers,
    messageCount,
    topSenders,
    reactionCount,
    topReactors,
    voiceAggregate,
    topVoiceRaw,
  ] = await Promise.all([
    prisma.metricsMember.count({
      where: { guildId, joinedAt: dateRange, isActive: true },
    }),

    prisma.metricsMember.count({
      where: { guildId, leftAt: dateRange, isActive: false },
    }),

    prisma.metricsMember.findMany({
      where: { guildId, leftAt: dateRange, isActive: false },
      select: { joinedAt: true, leftAt: true },
    }),

    prisma.metricsMessageEvent.count({
      where: { guildId, createdAt: dateRange },
    }),

    prisma.metricsMessageEvent.groupBy({
      by: ['userId'],
      where: { guildId, createdAt: dateRange },
      _count: { userId: true },
      orderBy: { _count: { userId: 'desc' } },
      take: topN,
    }),

    prisma.metricsReactionEvent.count({
      where: { guildId, eventType: 'added', createdAt: dateRange },
    }),

    prisma.metricsReactionEvent.groupBy({
      by: ['userId'],
      where: { guildId, eventType: 'added', createdAt: dateRange },
      _count: { userId: true },
      orderBy: { _count: { userId: 'desc' } },
      take: topN,
    }),

    prisma.metricsCompletedVoiceSession.aggregate({
      where: { guildId, leaveTimestamp: dateRange },
      _sum: { durationSeconds: true },
    }),

    prisma.metricsCompletedVoiceSession.groupBy({
      by: ['userId'],
      where: { guildId, leaveTimestamp: dateRange },
      _sum: { durationSeconds: true },
      orderBy: { _sum: { durationSeconds: 'desc' } },
      take: topN,
    }),
  ]);

  const leaverStayStats: LeaverStayStats = {
    lt7Days: 0,
    lt15Days: 0,
    lt1Month: 0,
    lt3Months: 0,
    lt6Months: 0,
    lt1Year: 0,
    gte1Year: 0,
    unknown: 0,
    totalLeavers: leavers.length,
  };

  for (const leaver of leavers) {
    if (!leaver.leftAt || !leaver.joinedAt) {
      leaverStayStats.unknown++;
      continue;
    }
    const daysInServer =
      (leaver.leftAt.getTime() - leaver.joinedAt.getTime()) / (1000 * 60 * 60 * 24);
    bucketLeaverStayDays(daysInServer, leaverStayStats);
  }

  const allUserIds = [
    ...topSenders.map((s) => s.userId),
    ...topReactors.map((r) => r.userId),
    ...topVoiceRaw.map((v) => v.userId),
  ];
  const usernameMap = await resolveUsernames(guildId, [...new Set(allUserIds)]);

  const topMessageSenders: TopUser[] = topSenders.map((s) => ({
    userId: s.userId,
    username: usernameMap.get(s.userId) ?? s.userId,
    count: s._count.userId,
  }));

  const topReactionUsers: TopUser[] = topReactors.map((r) => ({
    userId: r.userId,
    username: usernameMap.get(r.userId) ?? r.userId,
    count: r._count.userId,
  }));

  const topVoiceUsers: TopUser[] = topVoiceRaw.map((v) => ({
    userId: v.userId,
    username: usernameMap.get(v.userId) ?? v.userId,
    count: v._sum.durationSeconds ?? 0,
  }));

  return {
    guildId,
    periodStart,
    periodEnd,
    newMembers,
    leftMembersCount,
    memberBalance: newMembers - leftMembersCount,
    leaverStayStats,
    messageCount,
    reactionCount,
    totalVoiceTimeSeconds: voiceAggregate._sum.durationSeconds ?? 0,
    topMessageSenders,
    topReactionUsers,
    topVoiceUsers,
  };
}

export async function generateDailyReport(
  guildId: string,
  date: Date,
  timezone: string,
): Promise<MetricsReportData> {
  const periodStart = getStartOfDayUTC(date, timezone);
  const periodEnd = getEndOfDayUTC(date, timezone);
  return generateReportData(guildId, periodStart, periodEnd, 3);
}

export async function generateWeeklyReport(
  guildId: string,
  date: Date,
  timezone: string,
): Promise<MetricsReportData> {
  const periodStart = getStartOfWeekUTC(date, timezone);
  const periodEnd = getEndOfWeekUTC(date, timezone);
  return generateReportData(guildId, periodStart, periodEnd, 10);
}

export async function generateMonthlyReport(
  guildId: string,
  date: Date,
  timezone: string,
): Promise<MetricsReportData> {
  const periodStart = getStartOfMonthUTC(date, timezone);
  const periodEnd = getEndOfMonthUTC(date, timezone);
  return generateReportData(guildId, periodStart, periodEnd, 10);
}
