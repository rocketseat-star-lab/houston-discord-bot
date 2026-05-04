import { Interaction, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { REPUTATION_CONFIG } from '../config';
import { toolsClient } from '../services/toolsClient';

const REPUTATION_COMMANDS = new Set(['recomendar', 'nao-recomendar', 'reputacao']);

export async function onInteraction(interaction: Interaction): Promise<void> {
  try {
    if (!interaction.isChatInputCommand()) return;
    if (!REPUTATION_COMMANDS.has(interaction.commandName)) return;

    const guildId = interaction.guild?.id;
    if (!guildId || guildId !== REPUTATION_CONFIG.activeGuildId) {
      await interaction.reply({
        content: 'Sistema de reputação não ativo neste servidor.',
        ephemeral: true,
      });
      return;
    }

    if (interaction.commandName === 'recomendar' || interaction.commandName === 'nao-recomendar') {
      return handleVote(interaction, interaction.commandName === 'recomendar' ? 'POSITIVE' : 'NEGATIVE');
    }
    if (interaction.commandName === 'reputacao') {
      return handleReputation(interaction);
    }
  } catch (err) {
    console.error('[reputation] onInteraction error:', err);
    try {
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Erro interno.', ephemeral: true });
      }
    } catch {}
  }
}

async function handleVote(
  interaction: ChatInputCommandInteraction,
  type: 'POSITIVE' | 'NEGATIVE'
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const target = interaction.options.getUser('membro', true);
  const reason = interaction.options.getString('motivo') || undefined;

  if (target.bot) {
    await interaction.editReply({ content: 'Bots não podem ser avaliados.' });
    return;
  }
  if (target.id === interaction.user.id) {
    await interaction.editReply({ content: 'Você não pode votar em si mesmo.' });
    return;
  }

  const member = interaction.member;
  const roleIds: string[] = [];
  let accountAgeDays = 0;

  if (member && 'joinedAt' in member && member.joinedAt) {
    accountAgeDays = Math.floor((Date.now() - member.joinedAt.getTime()) / (1000 * 60 * 60 * 24));
  }
  if (member && 'roles' in member && member.roles && 'cache' in member.roles) {
    member.roles.cache.forEach((r) => roleIds.push(r.id));
  }

  const result = await toolsClient.castVote({
    guildId: interaction.guild!.id,
    voterDiscordId: interaction.user.id,
    voterUsername: interaction.user.username,
    voterRoleIds: roleIds,
    voterAccountAgeDays: accountAgeDays,
    targetDiscordId: target.id,
    targetUsername: target.username,
    type,
    reason,
  });

  await interaction.editReply({ content: result.message });
}

async function handleReputation(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const queriedUser = interaction.options.getUser('membro');
  const requestingOther = !!queriedUser && queriedUser.id !== interaction.user.id;

  if (requestingOther) {
    const memberPerms = interaction.memberPermissions;
    const hasModPerm =
      memberPerms?.has(PermissionFlagsBits.ModerateMembers) ||
      memberPerms?.has(PermissionFlagsBits.ManageMessages) ||
      memberPerms?.has(PermissionFlagsBits.Administrator);
    if (!hasModPerm) {
      await interaction.editReply({
        content: 'Apenas moderadores podem ver a reputação de outros membros.',
      });
      return;
    }
  }

  const targetUser = queriedUser || interaction.user;
  const result = await toolsClient.getMyScore(interaction.guild!.id, targetUser.id);

  if (!result) {
    await interaction.editReply({ content: 'Não foi possível buscar a reputação agora.' });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`Reputação de ${targetUser.username}`)
    .setColor(reputationColor(result.scoreTotal))
    .setDescription(
      result.message ||
        `Pontuação: **${Math.round(result.scoreTotal)} / 100**\n${descriptionForScore(result.scoreTotal)}`
    )
    .setThumbnail(targetUser.displayAvatarURL());

  await interaction.editReply({ embeds: [embed] });
}

function reputationColor(score: number): number {
  if (score >= 70) return 0x22c55e;
  if (score >= 50) return 0x3b82f6;
  if (score >= 30) return 0xf59e0b;
  return 0xef4444;
}

function descriptionForScore(score: number): string {
  if (score >= 70) return 'Membro com excelente reputação na comunidade.';
  if (score >= 50) return 'Membro engajado com boa conduta.';
  if (score >= 30) return 'Reputação em construção. Continue contribuindo.';
  return 'Reputação baixa. Atenção a sua conduta na comunidade.';
}
