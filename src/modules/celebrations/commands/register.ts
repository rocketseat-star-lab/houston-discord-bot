import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

const ACTIVE_GUILD_ID = '327861810768117763';

const commands = [
  new SlashCommandBuilder()
    .setName('aniversariantes')
    .setDescription('Gerenciamento de celebrações de aniversário e tempo de empresa')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub.setName('hoje').setDescription('Lista aniversariantes do dia (pessoal e empresa)')
    )
    .addSubcommand((sub) =>
      sub.setName('proximos').setDescription('Próximos aniversariantes nos próximos 7 dias')
    )
    .addSubcommand((sub) =>
      sub.setName('celebrar').setDescription('Forçar envio agora no Slack (mesma lógica do scheduler)')
    ),
];

export async function registerCelebrationsSlashCommands(clientId: string): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    console.error('[celebrations] DISCORD_BOT_TOKEN ausente.');
    return;
  }
  const rest = new REST({ version: '10' }).setToken(token);
  const data = commands.map((c) => c.toJSON());

  try {
    const existing = (await rest.get(
      Routes.applicationGuildCommands(clientId, ACTIVE_GUILD_ID)
    )) as Array<{ name: string }>;
    const ourNames = new Set(commands.map((c) => c.name));
    const others = existing.filter((c) => !ourNames.has(c.name));
    await rest.put(Routes.applicationGuildCommands(clientId, ACTIVE_GUILD_ID), {
      body: [...others, ...data],
    });
    console.log(`[celebrations] Slash commands registered for guild ${ACTIVE_GUILD_ID}`);
  } catch (err) {
    console.error('[celebrations] Failed to register commands:', err);
  }
}
