import prisma from '../../../services/prisma';
import type { MetricsReportData } from './reportService';

export async function saveReportSnapshot(
  reportType: 'daily' | 'weekly' | 'monthly',
  data: MetricsReportData
): Promise<void> {
  await prisma.metricsReportSnapshot.upsert({
    where: {
      guildId_reportType_periodStart: {
        guildId: data.guildId,
        reportType,
        periodStart: data.periodStart,
      },
    },
    create: {
      guildId: data.guildId,
      reportType,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      data: data as any,
    },
    update: {
      periodEnd: data.periodEnd,
      data: data as any,
    },
  });
}

export async function getReportSnapshots(
  guildId: string,
  reportType?: string,
  options?: { page?: number; limit?: number }
) {
  const page = options?.page || 1;
  const limit = options?.limit || 30;
  const skip = (page - 1) * limit;

  const where: { guildId: string; reportType?: string } = { guildId };
  if (reportType) {
    where.reportType = reportType;
  }

  const [snapshots, total] = await Promise.all([
    prisma.metricsReportSnapshot.findMany({
      where,
      orderBy: { periodStart: 'desc' },
      skip,
      take: limit,
    }),
    prisma.metricsReportSnapshot.count({ where }),
  ]);

  return { data: snapshots, total, page, limit };
}

export async function getReportSnapshot(
  guildId: string,
  reportType: string,
  periodStart: Date
) {
  return prisma.metricsReportSnapshot.findUnique({
    where: {
      guildId_reportType_periodStart: {
        guildId,
        reportType,
        periodStart,
      },
    },
  });
}
