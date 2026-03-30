import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { METRICS_CONFIG } from '../config';

const commands = [
  new SlashCommandBuilder()
    .setName('report')
    .setDescription('Gera relatorios de metricas do servidor')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub
        .setName('daily')
        .setDescription('Relatorio diario')
        .addStringOption(opt =>
          opt
            .setName('date')
            .setDescription('Data no formato DD/MM/YYYY (padrao: ontem)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('weekly')
        .setDescription('Relatorio semanal')
        .addStringOption(opt =>
          opt
            .setName('date')
            .setDescription('Data dentro da semana desejada, DD/MM/YYYY (padrao: semana passada)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('monthly')
        .setDescription('Relatorio mensal')
        .addStringOption(opt =>
          opt
            .setName('date')
            .setDescription('Data dentro do mes desejado, DD/MM/YYYY (padrao: mes passado)')
            .setRequired(false)
        )
    ),

  new SlashCommandBuilder()
    .setName('status-metrics')
    .setDescription('Verifica o status do modulo de metricas')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
];

export async function registerSlashCommands(clientId: string): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    console.error('[metrics] DISCORD_BOT_TOKEN not set, cannot register commands');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(token);
  const commandsData = commands.map(cmd => cmd.toJSON());

  for (const guildId of METRICS_CONFIG.allowedGuildIds) {
    try {
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commandsData }
      );
      console.log(`[metrics] Slash commands registered for guild ${guildId}`);
    } catch (error) {
      console.error(`[metrics] Failed to register commands for guild ${guildId}:`, error);
    }
  }
}
