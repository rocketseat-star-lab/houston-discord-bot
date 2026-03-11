import prisma from "../prisma";
import { ReportCategory } from "@prisma/client";

export interface CreateReportInput {
  discordThreadId: string;
  discordUserId: string;
  title: string;
  description: string;
  solution?: string;
  category?: ReportCategory;
  resolvedAt?: Date;
}

export async function createReport(data: CreateReportInput) {
  const report = await prisma.report.create({
    data: {
      discordThreadId: data.discordThreadId,
      discordUserId: data.discordUserId,
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
