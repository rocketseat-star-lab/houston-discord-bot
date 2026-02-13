/**
 * Serviço simplificado para sincronizar cache de membros atuais
 */

import { Client } from 'discord.js';
import prisma from '../services/prisma';

/**
 * Sincroniza membros de TODAS as guilds quando o bot inicia
 * Mantém CurrentMember atualizado para queries rápidas
 */
export async function syncAllGuildMembers(client: Client<true>) {
  console.log('[MemberSync] 🚀 Sincronizando cache de membros...');

  const guilds = Array.from(client.guilds.cache.values());
  console.log(`[MemberSync] Total de guilds: ${guilds.length}`);

  for (const guild of guilds) {
    try {
      console.log(`[MemberSync] 📊 ${guild.name}...`);

      await guild.members.fetch();
      const members = Array.from(guild.members.cache.values());

      // Buscar membros já cadastrados
      const existingMembers = await prisma.currentMember.findMany({
        where: { guildId: guild.id },
        select: { userId: true },
      });
      const existingUserIds = new Set(existingMembers.map(m => m.userId));

      // Inserir apenas novos membros
      const newMembers = members.filter(m => !existingUserIds.has(m.user.id));

      if (newMembers.length > 0) {
        await prisma.currentMember.createMany({
          data: newMembers.map((member) => ({
            guildId: guild.id,
            userId: member.user.id,
            username: member.user.username,
            tag: member.user.tag,
            displayName: member.displayName,
            avatarUrl: member.user.displayAvatarURL({ size: 256 }),
            isBot: member.user.bot,
            joinedAt: member.joinedAt,
          })),
          skipDuplicates: true,
        });
        console.log(`[MemberSync] ✅ ${guild.name}: +${newMembers.length} novos membros`);
      }

      // Limpar membros que saíram
      const discordMemberIds = new Set(members.map(m => m.user.id));
      const staleMembers = existingMembers.filter((m) => !discordMemberIds.has(m.userId));

      if (staleMembers.length > 0) {
        await prisma.currentMember.deleteMany({
          where: {
            guildId: guild.id,
            userId: { in: staleMembers.map((m) => m.userId) },
          },
        });
        console.log(`[MemberSync] 🗑️ ${guild.name}: -${staleMembers.length} membros removidos`);
      }
    } catch (error) {
      console.error(`[MemberSync] ❌ Erro em ${guild.name}:`, error);
    }
  }

  console.log('[MemberSync] 🎉 Sincronização completa!');
}
