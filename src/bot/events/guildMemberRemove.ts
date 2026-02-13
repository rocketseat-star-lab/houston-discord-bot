import { Events, GuildMember } from 'discord.js';
import prisma from '../../services/prisma';

export default {
  name: Events.GuildMemberRemove,
  async execute(member: GuildMember) {
    try {
      const leftAt = new Date();
      const memberSince = member.joinedAt;
      const daysInServer = memberSince
        ? Math.floor((leftAt.getTime() - memberSince.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      // Registrar saída no log
      await prisma.memberLeaveLog.create({
        data: {
          guildId: member.guild.id,
          userId: member.user.id,
          username: member.user.tag,
          leftAt,
          memberSince,
          daysInServer,
        },
      });

      // Remover do cache de membros atuais
      await prisma.currentMember.deleteMany({
        where: {
          guildId: member.guild.id,
          userId: member.user.id,
        },
      });

      console.log(`[MemberLeaveLog] ${member.user.tag} saiu de ${member.guild.name}${daysInServer ? ` (${daysInServer} dias)` : ''}`);
    } catch (error) {
      console.error('[guildMemberRemove] Erro ao registrar saída de membro:', error);
    }
  },
};
