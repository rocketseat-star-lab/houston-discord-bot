import { ChatInputCommandInteraction, EmbedBuilder, Interaction } from 'discord.js';
import { toolsClient } from '../services/toolsClient';
import { dispatchCelebrations } from '../services/dispatcher';
import { formatBR } from '../services/dateLogic';

export async function onInteraction(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'aniversariantes') return;

  try {
    const sub = interaction.options.getSubcommand();
    if (sub === 'hoje') return handleHoje(interaction);
    if (sub === 'proximos') return handleProximos(interaction);
    if (sub === 'celebrar') return handleCelebrar(interaction);
  } catch (err) {
    console.error('[celebrations] onInteraction error:', err);
    try {
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Erro interno.', ephemeral: true });
      }
    } catch {}
  }
}

async function handleHoje(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  const [birthdays, admissions] = await Promise.all([
    toolsClient.findBoosters('birthday', month, day),
    toolsClient.findBoosters('admission', month, day),
  ]);

  const embed = new EmbedBuilder()
    .setTitle(`Aniversariantes de hoje (${formatBR(today)})`)
    .setColor(0x9b59b6);

  embed.addFields({
    name: `🎉 Aniversário pessoal (${birthdays.length})`,
    value: birthdays.length
      ? birthdays.map((b) => `• ${b.full_name}`).join('\n')
      : 'Nenhum',
  });
  embed.addFields({
    name: `🚀 Tempo de empresa (${admissions.length})`,
    value: admissions.length
      ? admissions.map((b) => `• ${b.full_name}`).join('\n')
      : 'Nenhum',
  });

  await interaction.editReply({ embeds: [embed] });
}

async function handleProximos(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const out: string[] = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const [birthdays, admissions] = await Promise.all([
      toolsClient.findBoosters('birthday', month, day),
      toolsClient.findBoosters('admission', month, day),
    ]);
    if (birthdays.length === 0 && admissions.length === 0) continue;
    const lines = [`**${formatBR(d)}**`];
    for (const b of birthdays) lines.push(`🎉 ${b.full_name}`);
    for (const b of admissions) lines.push(`🚀 ${b.full_name}`);
    out.push(lines.join('\n'));
  }

  await interaction.editReply({
    content: out.length ? out.join('\n\n') : 'Nenhum aniversariante nos próximos 7 dias.',
  });
}

async function handleCelebrar(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const result = await dispatchCelebrations(new Date());
  await interaction.editReply({
    content: [
      'Disparo executado.',
      `Aniversariantes pessoais: **${result.birthdays}**`,
      `Tempo de empresa: **${result.anniversaries}**`,
      result.datesCovered.length
        ? `Datas cobertas: ${result.datesCovered.join(', ')}`
        : 'Nenhuma data útil hoje (weekend/feriado).',
    ].join('\n'),
  });
}
