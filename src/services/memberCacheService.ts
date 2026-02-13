import { Client } from 'discord.js';
import prisma from './prisma';

/**
 * Faz fetch de TODOS os membros de todas as guilds e armazena no banco
 * Isso evita rate limiting ao buscar membros 1 por 1
 */
export async function syncAllMembersToDatabase(client: Client) {
  console.log('[MemberCache] Iniciando sincronização de todos os membros...');

  try {
    const guilds = Array.from(client.guilds.cache.values());
    let totalMembers = 0;

    for (const guild of guilds) {
      console.log(`[MemberCache] Fetching membros da guild ${guild.name} (${guild.id})...`);

      // Fetch TODOS os membros da guild de uma vez
      await guild.members.fetch();

      const members = Array.from(guild.members.cache.values());
      console.log(`[MemberCache] ${members.length} membros encontrados em ${guild.name}`);

      // Preparar dados para batch insert
      const memberData = members.map((member) => ({
        guildId: guild.id,
        userId: member.user.id,
        username: member.user.username,
        tag: member.user.tag,
        displayName: member.displayName,
        avatarUrl: member.user.displayAvatarURL({ size: 256 }),
        isBot: member.user.bot,
        joinedAt: member.joinedAt,
      }));

      // Deletar membros antigos desta guild e inserir os novos em batch
      await prisma.$transaction(async (tx) => {
        // Deletar cache antigo desta guild
        await tx.currentMember.deleteMany({
          where: { guildId: guild.id },
        });

        // Inserir todos os membros atuais em batch
        await tx.currentMember.createMany({
          data: memberData,
          skipDuplicates: true,
        });
      });

      totalMembers += members.length;
      console.log(`[MemberCache] ✅ ${members.length} membros sincronizados para ${guild.name}`);
    }

    console.log(`[MemberCache] ✅ Sincronização completa! Total: ${totalMembers} membros`);
  } catch (error) {
    console.error('[MemberCache] ❌ Erro ao sincronizar membros:', error);
    throw error;
  }
}

/**
 * Atualiza um membro específico no cache
 * Usado quando um evento de membro é disparado (update, join, etc)
 */
export async function updateMemberInCache(guildId: string, userId: string, client: Client) {
  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      console.warn(`[MemberCache] Guild ${guildId} não encontrada no cache do bot`);
      return;
    }

    const member = await guild.members.fetch(userId);
    if (!member) {
      console.warn(`[MemberCache] Membro ${userId} não encontrado na guild ${guildId}`);
      return;
    }

    await prisma.currentMember.upsert({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
      },
      update: {
        username: member.user.username,
        tag: member.user.tag,
        displayName: member.displayName,
        avatarUrl: member.user.displayAvatarURL({ size: 256 }),
        isBot: member.user.bot,
        joinedAt: member.joinedAt,
      },
      create: {
        guildId,
        userId,
        username: member.user.username,
        tag: member.user.tag,
        displayName: member.displayName,
        avatarUrl: member.user.displayAvatarURL({ size: 256 }),
        isBot: member.user.bot,
        joinedAt: member.joinedAt,
      },
    });

    console.log(`[MemberCache] ✅ Membro ${member.user.tag} atualizado no cache`);
  } catch (error) {
    console.error(`[MemberCache] ❌ Erro ao atualizar membro ${userId}:`, error);
  }
}

/**
 * Remove um membro do cache
 * Usado quando um membro sai da guild
 */
export async function removeMemberFromCache(guildId: string, userId: string) {
  try {
    await prisma.currentMember.delete({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
      },
    });

    console.log(`[MemberCache] ✅ Membro ${userId} removido do cache`);
  } catch (error) {
    // Ignorar erro se o membro já não existir no cache
    if ((error as any).code !== 'P2025') {
      console.error(`[MemberCache] ❌ Erro ao remover membro ${userId}:`, error);
    }
  }
}
