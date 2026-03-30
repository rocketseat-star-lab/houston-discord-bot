import { Client } from 'discord.js';
import { METRICS_CONFIG } from '../config';
import {
  generateDailyReport,
  generateWeeklyReport,
  generateMonthlyReport,
} from '../services/reportService';
import { saveReportSnapshot } from '../services/snapshotService';
import {
  getYesterdayInTimezone,
  getLastWeekDateInTimezone,
  getLastMonthDateInTimezone,
} from '../utils/dateUtils';

let discordClient: Client;

export function setClient(client: Client) {
  discordClient = client;
}

export async function runDailyReports(): Promise<void> {
  const yesterday = getYesterdayInTimezone(METRICS_CONFIG.timezone);

  for (const guildId of METRICS_CONFIG.allowedGuildIds) {
    try {
      const report = await generateDailyReport(guildId, yesterday, METRICS_CONFIG.timezone);
      await saveReportSnapshot('daily', report);
      console.log(
        `[metrics/scheduler] Daily snapshot saved for guild ${guildId}: ${report.messageCount} messages, ${report.newMembers} new members`,
      );
    } catch (error) {
      console.error(
        `[metrics/scheduler] Failed daily report for guild ${guildId}:`,
        error,
      );
    }
  }
}

export async function runWeeklyReports(): Promise<void> {
  const lastWeek = getLastWeekDateInTimezone(METRICS_CONFIG.timezone);

  for (const guildId of METRICS_CONFIG.allowedGuildIds) {
    try {
      const report = await generateWeeklyReport(guildId, lastWeek, METRICS_CONFIG.timezone);
      await saveReportSnapshot('weekly', report);
      console.log(`[metrics/scheduler] Weekly snapshot saved for guild ${guildId}`);
    } catch (error) {
      console.error(
        `[metrics/scheduler] Failed weekly report for guild ${guildId}:`,
        error,
      );
    }
  }
}

export async function runMonthlyReports(): Promise<void> {
  const lastMonth = getLastMonthDateInTimezone(METRICS_CONFIG.timezone);

  for (const guildId of METRICS_CONFIG.allowedGuildIds) {
    try {
      const report = await generateMonthlyReport(guildId, lastMonth, METRICS_CONFIG.timezone);
      await saveReportSnapshot('monthly', report);
      console.log(`[metrics/scheduler] Monthly snapshot saved for guild ${guildId}`);
    } catch (error) {
      console.error(
        `[metrics/scheduler] Failed monthly report for guild ${guildId}:`,
        error,
      );
    }
  }
}
