import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { REPUTATION_CONFIG } from '../config';

const commands = [
  new SlashCommandBuilder()
    .setName('recomendar')
    .setDescription('Recomende positivamente um membro pela conduta na comunidade')
    .addUserOption((opt) =>
      opt.setName('membro').setDescription('Membro que você quer recomendar').setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('nao-recomendar')
    .setDescription('Sinalize um membro com comportamento ruim na comunidade')
    .addUserOption((opt) =>
      opt.setName('membro').setDescription('Membro que você quer sinalizar').setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('motivo')
        .setDescription('Explicação concreta do motivo (mínimo 20 caracteres)')
        .setRequired(true)
        .setMinLength(20)
        .setMaxLength(500)
    ),

  new SlashCommandBuilder()
    .setName('reputacao')
    .setDescription('Veja a própria reputação ou de outro membro (apenas moderação)')
    .addUserOption((opt) =>
      opt.setName('membro').setDescription('Apenas moderadores podem ver de outros').setRequired(false)
    ),
];

export async function registerReputationSlashCommands(clientId: string): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    console.error('[reputation] DISCORD_BOT_TOKEN not set, cannot register commands');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(token);
  const data = commands.map((c) => c.toJSON());

  const guildId = REPUTATION_CONFIG.activeGuildId;
  try {
    // Merge with any commands already registered for this guild (from other modules).
    const existing = (await rest.get(
      Routes.applicationGuildCommands(clientId, guildId)
    )) as Array<{ name: string }>;
    const ourNames = new Set(commands.map((c) => c.name));
    const others = existing.filter((c) => !ourNames.has(c.name));
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: [...others, ...data],
    });
    console.log(`[reputation] Slash commands registered for guild ${guildId}`);
  } catch (err) {
    console.error(`[reputation] Failed to register commands for guild ${guildId}:`, err);
  }
}
