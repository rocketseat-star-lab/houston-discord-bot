import { Events, GuildMember } from 'discord.js';
import prisma from '../../services/prisma';

export default {
  name: Events.GuildMemberAdd,
  async execute(member: GuildMember) {
    try {
      // Registrar entrada no log
      await prisma.memberJoinLog.create({
        data: {
          guildId: member.guild.id,
          userId: member.user.id,
          username: member.user.tag,
          discriminator: member.user.discriminator !== '0' ? member.user.discriminator : null,
          avatarUrl: member.user.displayAvatarURL(),
          isBot: member.user.bot,
          joinedAt: member.joinedAt || new Date(),
        },
      });

      // Adicionar/atualizar cache de membros atuais (upsert para lidar com retornos)
      await prisma.currentMember.upsert({
        where: {
          guildId_userId: {
            guildId: member.guild.id,
            userId: member.user.id,
          },
        },
        update: {
          username: member.user.username,
          tag: member.user.tag,
          displayName: member.displayName,
          avatarUrl: member.user.displayAvatarURL({ size: 256 }),
          isBot: member.user.bot,
          joinedAt: member.joinedAt,
          updatedAt: new Date(),
        },
        create: {
          guildId: member.guild.id,
          userId: member.user.id,
          username: member.user.username,
          tag: member.user.tag,
          displayName: member.displayName,
          avatarUrl: member.user.displayAvatarURL({ size: 256 }),
          isBot: member.user.bot,
          joinedAt: member.joinedAt,
        },
      });

      console.log(`[MemberJoinLog] ${member.user.tag} entrou em ${member.guild.name}`);
    } catch (error) {
      console.error('[guildMemberAdd] Erro ao registrar entrada de membro:', error);
    }
  },
};
