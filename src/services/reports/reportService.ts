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
