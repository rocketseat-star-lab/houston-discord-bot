import { Interaction, EmbedBuilder } from 'discord.js';
import { METRICS_CONFIG } from '../config';
import { generateDailyReport, generateWeeklyReport, generateMonthlyReport, MetricsReportData } from '../services/reportService';
import { formatDailyReportEmbed, formatWeeklyReportEmbed, formatMonthlyReportEmbed, ReportData } from '../utils/embedFormatter';
import { formatDateInTimezone, getYesterdayInTimezone, getLastWeekDateInTimezone, getLastMonthDateInTimezone } from '../utils/dateUtils';
import prisma from '../../../services/prisma';

const TZ = METRICS_CONFIG.timezone;

export async function onInteraction(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'status-metrics') {
    return handleStatusMetrics(interaction);
  }

  if (interaction.commandName !== 'report') return;

  const guildId = interaction.guild?.id;
  if (!guildId || !METRICS_CONFIG.allowedGuildIds.includes(guildId)) return;

  try {
    await interaction.deferReply({ ephemeral: true });

    const subcommand = interaction.options.getSubcommand();
    const dateInput = interaction.options.getString('date') || null;

    const guildName = interaction.guild?.name || guildId;
    const guildIconURL = interaction.guild?.iconURL() || undefined;

    switch (subcommand) {
      case 'daily': {
        const date = dateInput ? parseDateString(dateInput) : getYesterdayInTimezone(TZ);
        const report = await generateDailyReport(guildId, date, TZ);
        const reportData = toReportData(report, guildName, guildIconURL, 'dd/MM/yyyy');
        const embed = formatDailyReportEmbed(reportData);
        await interaction.editReply({ embeds: [embed] });
        break;
      }
      case 'weekly': {
        const date = dateInput ? parseDateString(dateInput) : getLastWeekDateInTimezone(TZ);
        const report = await generateWeeklyReport(guildId, date, TZ);
        const reportData = toReportData(report, guildName, guildIconURL, 'dd/MM/yyyy');
        const embed = formatWeeklyReportEmbed(reportData);
        await interaction.editReply({ embeds: [embed] });
        break;
      }
      case 'monthly': {
        const date = dateInput ? parseDateString(dateInput) : getLastMonthDateInTimezone(TZ);
        const report = await generateMonthlyReport(guildId, date, TZ);
        const reportData = toReportData(report, guildName, guildIconURL, 'MM/yyyy');
        const embed = formatMonthlyReportEmbed(reportData);
        await interaction.editReply({ embeds: [embed] });
        break;
      }
      default: {
        await interaction.editReply({ content: 'Subcomando desconhecido. Use: daily, weekly ou monthly.' });
      }
    }
  } catch (error) {
    console.error(`[metrics] Error handling /report command:`, error);
    try {
      await interaction.editReply({ content: 'Ocorreu um erro ao gerar o relatorio. Tente novamente mais tarde.' });
    } catch {
      // Interaction may have expired
    }
  }
}

function toReportData(
  data: MetricsReportData,
  guildName: string,
  guildIconURL?: string,
  dateFormat?: string
): ReportData {
  const fmt = dateFormat || 'dd/MM/yyyy';
  return {
    guildName,
    guildIconURL,
    periodStart: formatDateInTimezone(data.periodStart, fmt, TZ),
    periodEnd: formatDateInTimezone(data.periodEnd, fmt, TZ),
    newMembers: data.newMembers,
    leftMembersCount: data.leftMembersCount,
    memberBalance: data.memberBalance,
    leaverStayStats: data.leaverStayStats,
    messageCount: data.messageCount,
    reactionCount: data.reactionCount,
    totalVoiceTimeSeconds: data.totalVoiceTimeSeconds,
    topMessageSenders: data.topMessageSenders,
    topReactionUsers: data.topReactionUsers,
    topVoiceUsers: data.topVoiceUsers,
  };
}

async function handleStatusMetrics(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const guildId = interaction.guild?.id;
  if (!guildId || !METRICS_CONFIG.allowedGuildIds.includes(guildId)) return;

  try {
    await interaction.deferReply({ ephemeral: true });

    const [
      memberCount,
      activeMemberCount,
      messageCount,
      reactionCount,
      voiceSessionCount,
      activeVoiceSessions,
      completedVoiceSessions,
    ] = await Promise.all([
      prisma.metricsMember.count({ where: { guildId } }),
      prisma.metricsMember.count({ where: { guildId, isActive: true } }),
      prisma.metricsMessageEvent.count({ where: { guildId } }),
      prisma.metricsReactionEvent.count({ where: { guildId } }),
      prisma.metricsVoiceEvent.count({ where: { guildId } }),
      prisma.metricsActiveVoiceSession.count({ where: { guildId } }),
      prisma.metricsCompletedVoiceSession.count({ where: { guildId } }),
    ]);

    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    const embed = new EmbedBuilder()
      .setTitle('Status do Modulo de Metricas')
      .setColor(0x00FF00)
      .setTimestamp()
      .addFields(
        {
          name: 'Bot',
          value: [
            `Uptime: **${hours}h ${minutes}m ${seconds}s**`,
            `Timezone: **${METRICS_CONFIG.timezone}**`,
            `Guilds monitoradas: **${METRICS_CONFIG.allowedGuildIds.length}**`,
          ].join('\n'),
          inline: false,
        },
        {
          name: 'Dados Coletados (este servidor)',
          value: [
            `Membros registrados: **${memberCount}** (${activeMemberCount} ativos)`,
            `Mensagens rastreadas: **${messageCount}**`,
            `Reacoes rastreadas: **${reactionCount}**`,
            `Eventos de voz: **${voiceSessionCount}**`,
            `Sessoes de voz ativas: **${activeVoiceSessions}**`,
            `Sessoes de voz completas: **${completedVoiceSessions}**`,
          ].join('\n'),
          inline: false,
        },
        {
          name: 'Schedulers (snapshots salvos no banco)',
          value: [
            'Diario: **00:01** todo dia (America/Sao_Paulo)',
            'Semanal: **Sexta 18:00** (America/Sao_Paulo)',
            'Mensal: **Dia 1 00:01** (America/Sao_Paulo)',
          ].join('\n'),
          inline: false,
        },
      );

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('[metrics] Error handling /status-metrics command:', error);
    try {
      await interaction.editReply({ content: 'Erro ao obter status das metricas.' });
    } catch {
      // Interaction may have expired
    }
  }
}

function parseDateString(input: string): Date {
  const parts = input.split('/');
  if (parts.length !== 3) {
    throw new Error(`Formato invalido: "${input}". Use DD/MM/YYYY.`);
  }

  const [day, month, year] = parts.map(Number);
  const date = new Date(year, month - 1, day);

  if (isNaN(date.getTime())) {
    throw new Error(`Data invalida: "${input}".`);
  }

  return date;
}
