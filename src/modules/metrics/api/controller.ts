import { Request, Response } from 'express';
import prisma from '../../../services/prisma';
import {
  generateDailyReport,
  generateWeeklyReport,
  generateMonthlyReport,
  MetricsReportData,
} from '../services/reportService';
import {
  periodQuerySchema,
  membersQuerySchema,
  topQuerySchema,
  generateReportSchema,
  paginationQuerySchema,
  snapshotsQuerySchema,
  dateRangeQuerySchema,
  topChannelsQuerySchema,
} from './validators';
import { METRICS_CONFIG } from '../config';
import { saveReportSnapshot, getReportSnapshots } from '../services/snapshotService';
import {
  getDailyMemberActivity,
  getDailyMessageActivity,
  getDailyReactionActivity,
  getDailyVoiceActivity,
  getTopChannels,
  getTopVoiceChannels,
  getMemberRetentionDistribution,
  getTotalMemberCount,
  getTopMessageSenders,
  getTopReactionUsers,
  getTopVoiceUsers,
} from '../services/timeseriesService';

function getDateFromQuery(dateStr?: string): Date {
  return dateStr ? new Date(dateStr) : new Date();
}

function generateByPeriod(
  guildId: string,
  period: string,
  date: Date,
  timezone: string,
): Promise<MetricsReportData> {
  switch (period) {
    case 'daily':
      return generateDailyReport(guildId, date, timezone);
    case 'weekly':
      return generateWeeklyReport(guildId, date, timezone);
    case 'monthly':
      return generateMonthlyReport(guildId, date, timezone);
    default:
      return generateDailyReport(guildId, date, timezone);
  }
}

function isGuildAllowed(guildId: string): boolean {
  return METRICS_CONFIG.allowedGuildIds.includes(guildId);
}

export async function getOverview(req: Request, res: Response): Promise<void> {
  try {
    const { guildId } = req.params;

    if (!isGuildAllowed(guildId)) {
      res.status(403).json({ error: 'Guild not allowed' });
      return;
    }

    const query = periodQuerySchema.parse(req.query);
    const date = getDateFromQuery(query.date);
    const report = await generateByPeriod(guildId, query.period, date, METRICS_CONFIG.timezone);

    res.json(report);
  } catch (error) {
    console.error('[metrics/api] Error in getOverview:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getMembers(req: Request, res: Response): Promise<void> {
  try {
    const { guildId } = req.params;

    if (!isGuildAllowed(guildId)) {
      res.status(403).json({ error: 'Guild not allowed' });
      return;
    }

    const query = membersQuerySchema.parse(req.query);
    const skip = (query.page - 1) * query.limit;

    const where: { guildId: string; isActive?: boolean } = { guildId };
    if (query.active !== undefined) {
      where.isActive = query.active === 'true';
    }

    const [members, total] = await Promise.all([
      prisma.metricsMember.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { joinedAt: 'desc' },
      }),
      prisma.metricsMember.count({ where }),
    ]);

    res.json({ data: members, total, page: query.page, limit: query.limit });
  } catch (error) {
    console.error('[metrics/api] Error in getMembers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getMembersActivity(req: Request, res: Response): Promise<void> {
  try {
    const { guildId } = req.params;

    if (!isGuildAllowed(guildId)) {
      res.status(403).json({ error: 'Guild not allowed' });
      return;
    }

    const query = periodQuerySchema.parse(req.query);
    const date = getDateFromQuery(query.date);
    const report = await generateByPeriod(guildId, query.period, date, METRICS_CONFIG.timezone);

    res.json({
      newMembers: report.newMembers,
      leftMembersCount: report.leftMembersCount,
      memberBalance: report.memberBalance,
      leaverStayStats: report.leaverStayStats,
    });
  } catch (error) {
    console.error('[metrics/api] Error in getMembersActivity:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getMessages(req: Request, res: Response): Promise<void> {
  try {
    const { guildId } = req.params;

    if (!isGuildAllowed(guildId)) {
      res.status(403).json({ error: 'Guild not allowed' });
      return;
    }

    const query = topQuerySchema.parse(req.query);
    const date = getDateFromQuery(query.date);
    const report = await generateByPeriod(guildId, query.period, date, METRICS_CONFIG.timezone);

    res.json({
      messageCount: report.messageCount,
      topSenders: report.topMessageSenders.slice(0, query.top),
    });
  } catch (error) {
    console.error('[metrics/api] Error in getMessages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getReactions(req: Request, res: Response): Promise<void> {
  try {
    const { guildId } = req.params;

    if (!isGuildAllowed(guildId)) {
      res.status(403).json({ error: 'Guild not allowed' });
      return;
    }

    const query = topQuerySchema.parse(req.query);
    const date = getDateFromQuery(query.date);
    const report = await generateByPeriod(guildId, query.period, date, METRICS_CONFIG.timezone);

    res.json({
      reactionCount: report.reactionCount,
      topUsers: report.topReactionUsers.slice(0, query.top),
    });
  } catch (error) {
    console.error('[metrics/api] Error in getReactions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getVoice(req: Request, res: Response): Promise<void> {
  try {
    const { guildId } = req.params;

    if (!isGuildAllowed(guildId)) {
      res.status(403).json({ error: 'Guild not allowed' });
      return;
    }

    const query = topQuerySchema.parse(req.query);
    const date = getDateFromQuery(query.date);
    const report = await generateByPeriod(guildId, query.period, date, METRICS_CONFIG.timezone);

    res.json({
      totalVoiceTimeSeconds: report.totalVoiceTimeSeconds,
      topUsers: report.topVoiceUsers.slice(0, query.top),
    });
  } catch (error) {
    console.error('[metrics/api] Error in getVoice:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getReport(req: Request, res: Response): Promise<void> {
  try {
    const { guildId } = req.params;

    if (!isGuildAllowed(guildId)) {
      res.status(403).json({ error: 'Guild not allowed' });
      return;
    }

    const query = periodQuerySchema.parse(req.query);
    const date = getDateFromQuery(query.date);
    const report = await generateByPeriod(guildId, query.period, date, METRICS_CONFIG.timezone);

    res.json(report);
  } catch (error) {
    console.error('[metrics/api] Error in getReport:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function generateReport(req: Request, res: Response): Promise<void> {
  try {
    const { guildId } = req.params;

    if (!isGuildAllowed(guildId)) {
      res.status(403).json({ error: 'Guild not allowed' });
      return;
    }

    const body = generateReportSchema.parse(req.body);
    const date = getDateFromQuery(body.date);
    const report = await generateByPeriod(guildId, body.type, date, METRICS_CONFIG.timezone);

    await saveReportSnapshot(body.type, report);

    res.json(report);
  } catch (error) {
    console.error('[metrics/api] Error in generateReport:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getSnapshots(req: Request, res: Response): Promise<void> {
  try {
    const { guildId } = req.params;

    if (!isGuildAllowed(guildId)) {
      res.status(403).json({ error: 'Guild not allowed' });
      return;
    }

    const query = snapshotsQuerySchema.parse(req.query);
    const result = await getReportSnapshots(guildId, query.type, {
      page: query.page,
      limit: query.limit,
    });

    res.json(result);
  } catch (error) {
    console.error('[metrics/api] Error in getSnapshots:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getTimeseries(req: Request, res: Response): Promise<void> {
  try {
    const { guildId, metric } = req.params;

    if (!isGuildAllowed(guildId)) {
      res.status(403).json({ error: 'Guild not allowed' });
      return;
    }

    const validMetrics = ['members', 'messages', 'reactions', 'voice'];
    if (!validMetrics.includes(metric)) {
      res.status(400).json({ error: `Invalid metric. Must be one of: ${validMetrics.join(', ')}` });
      return;
    }

    const query = dateRangeQuerySchema.parse(req.query);
    const from = new Date(query.from);
    const to = new Date(query.to);

    let data;
    switch (metric) {
      case 'members':
        data = await getDailyMemberActivity(guildId, from, to);
        break;
      case 'messages':
        data = await getDailyMessageActivity(guildId, from, to);
        break;
      case 'reactions':
        data = await getDailyReactionActivity(guildId, from, to);
        break;
      case 'voice':
        data = await getDailyVoiceActivity(guildId, from, to);
        break;
    }

    res.json({ metric, from: query.from, to: query.to, data });
  } catch (error) {
    console.error('[metrics/api] Error in getTimeseries:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getChannelRanking(req: Request, res: Response): Promise<void> {
  try {
    const { guildId } = req.params;

    if (!isGuildAllowed(guildId)) {
      res.status(403).json({ error: 'Guild not allowed' });
      return;
    }

    const query = topChannelsQuerySchema.parse(req.query);
    const from = new Date(query.from);
    const to = new Date(query.to);

    const data = await getTopChannels(guildId, from, to, query.limit);

    res.json({ data });
  } catch (error) {
    console.error('[metrics/api] Error in getChannelRanking:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getVoiceChannelRanking(req: Request, res: Response): Promise<void> {
  try {
    const { guildId } = req.params;

    if (!isGuildAllowed(guildId)) {
      res.status(403).json({ error: 'Guild not allowed' });
      return;
    }

    const query = topChannelsQuerySchema.parse(req.query);
    const from = new Date(query.from);
    const to = new Date(query.to);

    const data = await getTopVoiceChannels(guildId, from, to, query.limit);

    res.json({ data });
  } catch (error) {
    console.error('[metrics/api] Error in getVoiceChannelRanking:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getRetentionDistribution(req: Request, res: Response): Promise<void> {
  try {
    const { guildId } = req.params;

    if (!isGuildAllowed(guildId)) {
      res.status(403).json({ error: 'Guild not allowed' });
      return;
    }

    const data = await getMemberRetentionDistribution(guildId);

    res.json({ data });
  } catch (error) {
    console.error('[metrics/api] Error in getRetentionDistribution:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getTotalMembers(req: Request, res: Response): Promise<void> {
  try {
    const { guildId } = req.params;

    if (!isGuildAllowed(guildId)) {
      res.status(403).json({ error: 'Guild not allowed' });
      return;
    }

    const data = await getTotalMemberCount(guildId);

    res.json(data);
  } catch (error) {
    console.error('[metrics/api] Error in getTotalMembers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getTopSenders(req: Request, res: Response): Promise<void> {
  try {
    const { guildId } = req.params;
    if (!isGuildAllowed(guildId)) { res.status(403).json({ error: 'Guild not allowed' }); return; }

    const query = topChannelsQuerySchema.parse(req.query);
    const data = await getTopMessageSenders(guildId, new Date(query.from), new Date(query.to), query.limit);
    res.json({ data });
  } catch (error) {
    console.error('[metrics/api] Error in getTopSenders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getTopReactors(req: Request, res: Response): Promise<void> {
  try {
    const { guildId } = req.params;
    if (!isGuildAllowed(guildId)) { res.status(403).json({ error: 'Guild not allowed' }); return; }

    const query = topChannelsQuerySchema.parse(req.query);
    const data = await getTopReactionUsers(guildId, new Date(query.from), new Date(query.to), query.limit);
    res.json({ data });
  } catch (error) {
    console.error('[metrics/api] Error in getTopReactors:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getTopVoiceUsersByRange(req: Request, res: Response): Promise<void> {
  try {
    const { guildId } = req.params;
    if (!isGuildAllowed(guildId)) { res.status(403).json({ error: 'Guild not allowed' }); return; }

    const query = topChannelsQuerySchema.parse(req.query);
    const data = await getTopVoiceUsers(guildId, new Date(query.from), new Date(query.to), query.limit);
    res.json({ data });
  } catch (error) {
    console.error('[metrics/api] Error in getTopVoiceUsersByRange:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
