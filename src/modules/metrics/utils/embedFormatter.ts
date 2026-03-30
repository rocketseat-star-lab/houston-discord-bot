import { EmbedBuilder } from 'discord.js';

export interface TopUser {
  userId: string;
  username: string;
  count: number;
}

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

export interface ReportData {
  guildName: string;
  guildIconURL?: string;
  periodStart: string;
  periodEnd?: string;
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

export function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0s';

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);

  return parts.join(' ') || '0s';
}

export function formatLeaverStats(stats: LeaverStayStats): string {
  const buckets: [string, number][] = [
    ['Menos de 7 dias', stats.lt7Days],
    ['Menos de 15 dias', stats.lt15Days],
    ['Menos de 1 mes', stats.lt1Month],
    ['Menos de 3 meses', stats.lt3Months],
    ['Menos de 6 meses', stats.lt6Months],
    ['Menos de 1 ano', stats.lt1Year],
    ['1 ano ou mais', stats.gte1Year],
    ['Desconhecido', stats.unknown],
  ];

  return buckets
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${label}: **${count}**`)
    .join('\n');
}

export function formatTopUsers(
  users: TopUser[],
  valueFormatter?: (count: number) => string
): string {
  if (users.length === 0) return 'Nenhum dado disponivel';

  const medals = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'];
  const formatter = valueFormatter ?? ((count: number) => `${count}`);

  return users
    .map((user, index) => {
      const medal = index < 3 ? `${medals[index]} ` : `**${index + 1}.** `;
      return `${medal}${user.username} - ${formatter(user.count)}`;
    })
    .join('\n');
}

function buildReportEmbed(
  data: ReportData,
  title: string,
  color: number
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setTimestamp();

  if (data.guildIconURL) {
    embed.setThumbnail(data.guildIconURL);
  }

  const periodDescription = data.periodEnd
    ? `Periodo: **${data.periodStart}** a **${data.periodEnd}**`
    : `Data: **${data.periodStart}**`;

  embed.setDescription(`${data.guildName}\n${periodDescription}`);

  embed.addFields({
    name: '\uD83D\uDC65 Membros',
    value: [
      `Entraram: **${data.newMembers}**`,
      `Sairam: **${data.leftMembersCount}**`,
      `Balanco: **${data.memberBalance >= 0 ? '+' : ''}${data.memberBalance}**`,
    ].join('\n'),
    inline: false,
  });

  if (data.leftMembersCount > 0) {
    const leaverStats = formatLeaverStats(data.leaverStayStats);
    if (leaverStats) {
      embed.addFields({
        name: '\uD83D\uDEAA Tempo de permanencia dos que sairam',
        value: leaverStats,
        inline: false,
      });
    }
  }

  embed.addFields({
    name: '\uD83D\uDCCA Atividade',
    value: [
      `Mensagens: **${data.messageCount}**`,
      `Reacoes: **${data.reactionCount}**`,
      `Tempo em voz: **${formatDuration(data.totalVoiceTimeSeconds)}**`,
    ].join('\n'),
    inline: false,
  });

  if (data.topMessageSenders.length > 0) {
    embed.addFields({
      name: '\uD83D\uDCAC Top Mensagens',
      value: formatTopUsers(data.topMessageSenders),
      inline: false,
    });
  }

  if (data.topReactionUsers.length > 0) {
    embed.addFields({
      name: '\u2B50 Top Reacoes',
      value: formatTopUsers(data.topReactionUsers),
      inline: false,
    });
  }

  if (data.topVoiceUsers.length > 0) {
    embed.addFields({
      name: '\uD83C\uDF99\uFE0F Top Voz',
      value: formatTopUsers(data.topVoiceUsers, formatDuration),
      inline: false,
    });
  }

  return embed;
}

export function formatDailyReportEmbed(data: ReportData): EmbedBuilder {
  return buildReportEmbed(data, 'Relatorio Diario', 0x0099ff);
}

export function formatWeeklyReportEmbed(data: ReportData): EmbedBuilder {
  return buildReportEmbed(data, 'Relatorio Semanal', 0x3498db);
}

export function formatMonthlyReportEmbed(data: ReportData): EmbedBuilder {
  return buildReportEmbed(data, 'Relatorio Mensal', 0x9b59b6);
}
