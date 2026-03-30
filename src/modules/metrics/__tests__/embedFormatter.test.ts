import { describe, it, expect } from 'vitest';
import {
  formatDuration,
  formatLeaverStats,
  formatTopUsers,
  formatDailyReportEmbed,
  formatWeeklyReportEmbed,
  formatMonthlyReportEmbed,
  type LeaverStayStats,
  type TopUser,
  type ReportData,
} from '../utils/embedFormatter';

function makeReportData(overrides: Partial<ReportData> = {}): ReportData {
  return {
    guildName: 'Test Guild',
    guildIconURL: 'https://example.com/icon.png',
    periodStart: '01/03/2026',
    periodEnd: '07/03/2026',
    newMembers: 10,
    leftMembersCount: 3,
    memberBalance: 7,
    leaverStayStats: {
      lt7Days: 1,
      lt15Days: 0,
      lt1Month: 1,
      lt3Months: 0,
      lt6Months: 0,
      lt1Year: 1,
      gte1Year: 0,
      unknown: 0,
      totalLeavers: 3,
    },
    messageCount: 500,
    reactionCount: 120,
    totalVoiceTimeSeconds: 7200,
    topMessageSenders: [
      { userId: '1', username: 'Alice', count: 100 },
      { userId: '2', username: 'Bob', count: 80 },
    ],
    topReactionUsers: [
      { userId: '3', username: 'Charlie', count: 50 },
    ],
    topVoiceUsers: [
      { userId: '4', username: 'Dave', count: 3600 },
    ],
    ...overrides,
  };
}

describe('embedFormatter', () => {
  describe('formatDuration', () => {
    it('should return "0s" for 0 seconds', () => {
      expect(formatDuration(0)).toBe('0s');
    });

    it('should return "0s" for negative values', () => {
      expect(formatDuration(-10)).toBe('0s');
    });

    it('should format seconds only', () => {
      expect(formatDuration(59)).toBe('59s');
    });

    it('should format minutes and seconds', () => {
      expect(formatDuration(61)).toBe('1m 1s');
    });

    it('should format hours only when exact', () => {
      expect(formatDuration(3600)).toBe('1h');
    });

    it('should format hours, minutes, and seconds', () => {
      expect(formatDuration(3661)).toBe('1h 1m 1s');
    });

    it('should format large values correctly', () => {
      // 48h 30m 15s = 48*3600 + 30*60 + 15 = 172800 + 1800 + 15 = 174615
      expect(formatDuration(174615)).toBe('48h 30m 15s');
    });

    it('should format hours and seconds without minutes', () => {
      // 1h 0m 30s = 3630
      expect(formatDuration(3630)).toBe('1h 30s');
    });

    it('should format exact minutes without seconds', () => {
      expect(formatDuration(120)).toBe('2m');
    });
  });

  describe('formatLeaverStats', () => {
    it('should only show non-zero buckets', () => {
      const stats: LeaverStayStats = {
        lt7Days: 5,
        lt15Days: 0,
        lt1Month: 3,
        lt3Months: 0,
        lt6Months: 0,
        lt1Year: 0,
        gte1Year: 2,
        unknown: 0,
        totalLeavers: 10,
      };

      const result = formatLeaverStats(stats);

      expect(result).toContain('Menos de 7 dias: **5**');
      expect(result).toContain('Menos de 1 mes: **3**');
      expect(result).toContain('1 ano ou mais: **2**');
      expect(result).not.toContain('Menos de 15 dias');
      expect(result).not.toContain('Menos de 3 meses');
      expect(result).not.toContain('Desconhecido');
    });

    it('should return empty string when all buckets are zero', () => {
      const stats: LeaverStayStats = {
        lt7Days: 0,
        lt15Days: 0,
        lt1Month: 0,
        lt3Months: 0,
        lt6Months: 0,
        lt1Year: 0,
        gte1Year: 0,
        unknown: 0,
        totalLeavers: 0,
      };

      const result = formatLeaverStats(stats);
      expect(result).toBe('');
    });

    it('should show all buckets when all are non-zero', () => {
      const stats: LeaverStayStats = {
        lt7Days: 1,
        lt15Days: 2,
        lt1Month: 3,
        lt3Months: 4,
        lt6Months: 5,
        lt1Year: 6,
        gte1Year: 7,
        unknown: 8,
        totalLeavers: 36,
      };

      const result = formatLeaverStats(stats);
      const lines = result.split('\n');
      expect(lines).toHaveLength(8);
    });
  });

  describe('formatTopUsers', () => {
    it('should show medal emojis for top 3 users', () => {
      const users: TopUser[] = [
        { userId: '1', username: 'First', count: 100 },
        { userId: '2', username: 'Second', count: 80 },
        { userId: '3', username: 'Third', count: 60 },
      ];

      const result = formatTopUsers(users);
      const lines = result.split('\n');

      expect(lines[0]).toMatch(/^.+ First - 100$/);
      expect(lines[1]).toMatch(/^.+ Second - 80$/);
      expect(lines[2]).toMatch(/^.+ Third - 60$/);

      // Verify medal emojis are present (gold, silver, bronze)
      expect(lines[0]).toContain('\uD83E\uDD47');
      expect(lines[1]).toContain('\uD83E\uDD48');
      expect(lines[2]).toContain('\uD83E\uDD49');
    });

    it('should show numbered positions for 4th and beyond', () => {
      const users: TopUser[] = [
        { userId: '1', username: 'First', count: 100 },
        { userId: '2', username: 'Second', count: 80 },
        { userId: '3', username: 'Third', count: 60 },
        { userId: '4', username: 'Fourth', count: 40 },
        { userId: '5', username: 'Fifth', count: 20 },
      ];

      const result = formatTopUsers(users);
      const lines = result.split('\n');

      expect(lines[3]).toContain('**4.**');
      expect(lines[3]).toContain('Fourth - 40');
      expect(lines[4]).toContain('**5.**');
      expect(lines[4]).toContain('Fifth - 20');
    });

    it('should return fallback message when no users', () => {
      const result = formatTopUsers([]);
      expect(result).toBe('Nenhum dado disponivel');
    });

    it('should use custom value formatter when provided', () => {
      const users: TopUser[] = [
        { userId: '1', username: 'Alice', count: 3661 },
      ];

      const result = formatTopUsers(users, formatDuration);

      expect(result).toContain('Alice - 1h 1m 1s');
    });

    it('should handle single user correctly', () => {
      const users: TopUser[] = [
        { userId: '1', username: 'Solo', count: 42 },
      ];

      const result = formatTopUsers(users);
      expect(result).toContain('\uD83E\uDD47');
      expect(result).toContain('Solo - 42');
      expect(result.split('\n')).toHaveLength(1);
    });
  });

  describe('formatDailyReportEmbed', () => {
    it('should return an embed with correct title and color', () => {
      const data = makeReportData();
      const embed = formatDailyReportEmbed(data);
      const json = embed.toJSON();

      expect(json.title).toBe('Relatorio Diario');
      expect(json.color).toBe(0x0099ff);
    });

    it('should include period description with single date when no periodEnd', () => {
      const data = makeReportData({ periodEnd: undefined });
      const embed = formatDailyReportEmbed(data);
      const json = embed.toJSON();

      expect(json.description).toContain('Data: **01/03/2026**');
    });

    it('should include period range when periodEnd is set', () => {
      const data = makeReportData();
      const embed = formatDailyReportEmbed(data);
      const json = embed.toJSON();

      expect(json.description).toContain('Periodo: **01/03/2026** a **07/03/2026**');
    });

    it('should include guild name in description', () => {
      const data = makeReportData();
      const embed = formatDailyReportEmbed(data);
      const json = embed.toJSON();

      expect(json.description).toContain('Test Guild');
    });

    it('should include member stats field', () => {
      const data = makeReportData();
      const embed = formatDailyReportEmbed(data);
      const json = embed.toJSON();

      const membersField = json.fields?.find((f) => f.name.includes('Membros'));
      expect(membersField).toBeDefined();
      expect(membersField!.value).toContain('Entraram: **10**');
      expect(membersField!.value).toContain('Sairam: **3**');
      expect(membersField!.value).toContain('Balanco: **+7**');
    });

    it('should show negative balance without plus sign', () => {
      const data = makeReportData({ newMembers: 2, leftMembersCount: 5, memberBalance: -3 });
      const embed = formatDailyReportEmbed(data);
      const json = embed.toJSON();

      const membersField = json.fields?.find((f) => f.name.includes('Membros'));
      expect(membersField!.value).toContain('Balanco: **-3**');
    });

    it('should include leaver stats when leftMembersCount > 0', () => {
      const data = makeReportData();
      const embed = formatDailyReportEmbed(data);
      const json = embed.toJSON();

      const leaverField = json.fields?.find((f) => f.name.includes('permanencia'));
      expect(leaverField).toBeDefined();
    });

    it('should not include leaver stats when leftMembersCount is 0', () => {
      const data = makeReportData({
        leftMembersCount: 0,
        leaverStayStats: {
          lt7Days: 0, lt15Days: 0, lt1Month: 0, lt3Months: 0,
          lt6Months: 0, lt1Year: 0, gte1Year: 0, unknown: 0, totalLeavers: 0,
        },
      });
      const embed = formatDailyReportEmbed(data);
      const json = embed.toJSON();

      const leaverField = json.fields?.find((f) => f.name.includes('permanencia'));
      expect(leaverField).toBeUndefined();
    });

    it('should include activity stats field with formatted voice time', () => {
      const data = makeReportData();
      const embed = formatDailyReportEmbed(data);
      const json = embed.toJSON();

      const activityField = json.fields?.find((f) => f.name.includes('Atividade'));
      expect(activityField).toBeDefined();
      expect(activityField!.value).toContain('Mensagens: **500**');
      expect(activityField!.value).toContain('Reacoes: **120**');
      expect(activityField!.value).toContain('Tempo em voz: **2h**');
    });

    it('should include top message senders when available', () => {
      const data = makeReportData();
      const embed = formatDailyReportEmbed(data);
      const json = embed.toJSON();

      const topField = json.fields?.find((f) => f.name.includes('Top Mensagens'));
      expect(topField).toBeDefined();
      expect(topField!.value).toContain('Alice');
    });

    it('should not include top message senders when empty', () => {
      const data = makeReportData({ topMessageSenders: [] });
      const embed = formatDailyReportEmbed(data);
      const json = embed.toJSON();

      const topField = json.fields?.find((f) => f.name.includes('Top Mensagens'));
      expect(topField).toBeUndefined();
    });

    it('should set thumbnail when guildIconURL is provided', () => {
      const data = makeReportData();
      const embed = formatDailyReportEmbed(data);
      const json = embed.toJSON();

      expect(json.thumbnail?.url).toBe('https://example.com/icon.png');
    });

    it('should not set thumbnail when guildIconURL is undefined', () => {
      const data = makeReportData({ guildIconURL: undefined });
      const embed = formatDailyReportEmbed(data);
      const json = embed.toJSON();

      expect(json.thumbnail).toBeUndefined();
    });

    it('should set timestamp', () => {
      const data = makeReportData();
      const embed = formatDailyReportEmbed(data);
      const json = embed.toJSON();

      expect(json.timestamp).toBeDefined();
    });
  });

  describe('formatWeeklyReportEmbed', () => {
    it('should return an embed with correct title and color', () => {
      const data = makeReportData();
      const embed = formatWeeklyReportEmbed(data);
      const json = embed.toJSON();

      expect(json.title).toBe('Relatorio Semanal');
      expect(json.color).toBe(0x3498db);
    });
  });

  describe('formatMonthlyReportEmbed', () => {
    it('should return an embed with correct title and color', () => {
      const data = makeReportData();
      const embed = formatMonthlyReportEmbed(data);
      const json = embed.toJSON();

      expect(json.title).toBe('Relatorio Mensal');
      expect(json.color).toBe(0x9b59b6);
    });
  });
});
