/**
 * Serviço otimizado de sincronização de membros
 * Combina paginação do Discord com batch inserts do Prisma
 */

import { Client } from 'discord.js';
import prisma from '../services/prisma';

const BATCH_SIZE = 750; // Tamanho do batch para inserir no banco
const FETCH_LIMIT = 1000; // Limite por fetch do Discord

/**
 * Sincroniza membros de UMA guild usando paginação e batch inserts
 */
async function syncGuildMembers(client: Client<true>, guildId: string): Promise<number> {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    console.error(`[MemberSync] Guild ${guildId} não encontrada`);
    return 0;
  }

  console.log(`[MemberSync] 📊 Iniciando ${guild.name} (${guild.memberCount} membros)`);

  let totalSynced = 0;
  let after: string | undefined = undefined;

  try {
    while (true) {
      // Fetch paginado do Discord
      const members = await guild.members.fetch({ limit: FETCH_LIMIT, after });

      if (members.size === 0) break;

      console.log(`[MemberSync] 📥 Fetched ${members.size} membros de ${guild.name}`);

      // Processar em batches menores para inserção no banco
      const membersArray = Array.from(members.values());

      for (let i = 0; i < membersArray.length; i += BATCH_SIZE) {
        const batchMembers = membersArray.slice(i, i + BATCH_SIZE);

        const memberData = batchMembers.map((member) => ({
          guildId: guild.id,
          userId: member.user.id,
          username: member.user.username,
          tag: member.user.tag,
          displayName: member.displayName,
          avatarUrl: member.user.displayAvatarURL({ size: 256 }),
          isBot: member.user.bot,
          joinedAt: member.joinedAt || new Date(),
        }));

        // Batch insert com createMany (muito mais rápido que upserts individuais)
        try {
          await prisma.currentMember.createMany({
            data: memberData,
            skipDuplicates: true, // Ignora membros que já existem
          });

          totalSynced += batchMembers.length;
          console.log(`[MemberSync] 💾 Salvos ${totalSynced}/${guild.memberCount} membros`);
        } catch (error) {
          console.error(`[MemberSync] ❌ Erro ao salvar batch:`, error);
        }
      }

      // Preparar próximo fetch
      const lastMemberId = Array.from(members.keys()).pop();
      if (!lastMemberId || members.size < FETCH_LIMIT) break;

      after = lastMemberId;

      // Pequeno delay para evitar rate limit
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log(`[MemberSync] ✅ ${guild.name}: ${totalSynced} membros sincronizados`);
    return totalSynced;

  } catch (error: any) {
    if (error.name === 'GatewayRateLimitError') {
      console.error(`[MemberSync] ❌ Rate limit em ${guild.name}: aguardar ${error.data?.retry_after}s`);
    } else {
      console.error(`[MemberSync] ❌ Erro em ${guild.name}:`, error);
    }
    return totalSynced;
  }
}

/**
 * Sincroniza TODAS as guilds do bot
 */
export async function syncAllGuildMembers(client: Client<true>) {
  console.log('[MemberSync] 🚀 Iniciando sincronização de todas as guilds...');

  const guilds = Array.from(client.guilds.cache.values());
  console.log(`[MemberSync] Total de guilds: ${guilds.length}`);

  for (const guild of guilds) {
    // NÃO pular guilds grandes - processar todas com paginação
    await syncGuildMembers(client, guild.id);

    // Delay entre guilds para evitar sobrecarga
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log('[MemberSync] 🎉 Sincronização completa!');
}

/**
 * Exporta função para sincronizar guild específica (útil para API)
 */
export async function syncSingleGuild(client: Client<true>, guildId: string): Promise<number> {
  return syncGuildMembers(client, guildId);
}
