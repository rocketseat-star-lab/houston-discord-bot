import prisma from "../prisma";
import { ReportCategory } from "@prisma/client";

export type ReportPlatform = "DISCORD" | "SLACK";

export interface CreateReportInput {
  platform: ReportPlatform;
  discordThreadId?: string;
  discordUserId?: string;
  slackChannelId?: string;
  slackThreadTs?: string;
  slackUserId?: string;
  title: string;
  description: string;
  solution?: string;
  category?: ReportCategory;
  resolvedAt?: Date;
}

export async function createReport(data: CreateReportInput) {
  const report = await prisma.report.create({
    data: {
      platform: data.platform,
      discordThreadId: data.discordThreadId,
      discordUserId: data.discordUserId,
      slackChannelId: data.slackChannelId,
      slackThreadTs: data.slackThreadTs,
      slackUserId: data.slackUserId,
      title: data.title,
      description: data.description,
      solution: data.solution,
      category: data.category,
      resolvedAt: data.resolvedAt,
    },
  });

  // Update search_vector for full-text search
  await prisma.$executeRaw`
    UPDATE houston_bot_reports
    SET search_vector = to_tsvector('portuguese', ${data.title} || ' ' || ${data.description})
    WHERE id = ${report.id}
  `;

  return report;
}

export async function updateReportSolution(
  threadId: string,
  solution: string,
  category: ReportCategory
) {
  const report = await prisma.report.update({
    where: {
      discordThreadId: threadId,
    },
    data: {
      solution,
      category,
      resolvedAt: new Date(),
    },
  });

  // Update search_vector in case title/description changed
  await prisma.$executeRaw`
    UPDATE houston_bot_reports
    SET search_vector = to_tsvector('portuguese', title || ' ' || description)
    WHERE discord_thread_id = ${threadId}
  `;

  return report;
}

export async function reportExists(threadId: string): Promise<boolean> {
  const count = await prisma.report.count({
    where: {
      discordThreadId: threadId,
    },
  });

  return count > 0;
}

export async function getReportByThreadId(threadId: string) {
  const report = await prisma.report.findUnique({
    where: {
      discordThreadId: threadId,
    },
  });

  return report;
}

// ============================================================================
// Slack-specific helpers
// ============================================================================

export async function slackReportExists(
  channelId: string,
  threadTs: string
): Promise<boolean> {
  const count = await prisma.report.count({
    where: { slackChannelId: channelId, slackThreadTs: threadTs },
  });
  return count > 0;
}

export async function getReportBySlackThread(channelId: string, threadTs: string) {
  return prisma.report.findUnique({
    where: {
      slackChannelId_slackThreadTs: {
        slackChannelId: channelId,
        slackThreadTs: threadTs,
      },
    },
  });
}

export async function updateSlackReportSolution(
  channelId: string,
  threadTs: string,
  solution: string,
  category: ReportCategory
) {
  const report = await prisma.report.update({
    where: {
      slackChannelId_slackThreadTs: {
        slackChannelId: channelId,
        slackThreadTs: threadTs,
      },
    },
    data: {
      solution,
      category,
      resolvedAt: new Date(),
    },
  });

  await prisma.$executeRaw`
    UPDATE houston_bot_reports
    SET search_vector = to_tsvector('portuguese', title || ' ' || description)
    WHERE slack_channel_id = ${channelId}
      AND slack_thread_ts = ${threadTs}
  `;

  return report;
}
