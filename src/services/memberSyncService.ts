/**
 * Serviço de sincronização de membros
 * Usa chunking automático do Discord.js + batch inserts
 */

import { Client, GuildMember } from 'discord.js';
import prisma from '../services/prisma';

const BATCH_SIZE = 750; // Tamanho do batch para inserir no banco

/**
 * Sincroniza membros de UMA guild
 * Discord.js faz chunking automático internamente via Gateway
 */
async function syncGuildMembers(client: Client<true>, guildId: string): Promise<number> {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    console.error(`[MemberSync] Guild ${guildId} não encontrada`);
    return 0;
  }

  console.log(`[MemberSync] 📊 Iniciando ${guild.name} (${guild.memberCount} membros)`);
  const startTime = Date.now();

  try {
    // Fetch TODOS os membros de uma vez
    // Discord.js faz chunking automático via Gateway
    console.log(`[MemberSync] 📥 Fetching membros de ${guild.name}...`);
    const membersCollection = await guild.members.fetch();

    const membersArray = Array.from(membersCollection.values());
    console.log(`[MemberSync] ✅ ${membersArray.length} membros fetched`);

    let totalSynced = 0;

    // Processar em batches para inserção no banco
    for (let i = 0; i < membersArray.length; i += BATCH_SIZE) {
      const batchMembers = membersArray.slice(i, i + BATCH_SIZE);

      const memberData = batchMembers.map((member: GuildMember) => ({
        guildId: guild.id,
        userId: member.user.id,
        username: member.user.username,
        tag: member.user.tag,
        displayName: member.displayName,
        avatarUrl: member.user.displayAvatarURL({ size: 256 }),
        isBot: member.user.bot,
        joinedAt: member.joinedAt || new Date(),
      }));

      // Batch insert com createMany (muito mais rápido que upserts)
      try {
        await prisma.currentMember.createMany({
          data: memberData,
          skipDuplicates: true, // Ignora duplicatas
        });

        totalSynced += batchMembers.length;
        const progress = ((totalSynced / membersArray.length) * 100).toFixed(1);
        console.log(`[MemberSync] 💾 ${progress}% - ${totalSynced}/${membersArray.length} membros salvos`);
      } catch (error) {
        console.error(`[MemberSync] ❌ Erro ao salvar batch:`, error);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[MemberSync] ✅ ${guild.name}: ${totalSynced} membros em ${duration}s`);
    return totalSynced;

  } catch (error: any) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    if (error.name === 'GatewayRateLimitError') {
      console.error(`[MemberSync] ❌ Rate limit em ${guild.name} após ${duration}s`);
      console.error(`[MemberSync] ⏸️  Retry after ${error.data?.retry_after}s`);
    } else {
      console.error(`[MemberSync] ❌ Erro em ${guild.name} após ${duration}s:`, error);
    }
    return 0;
  }
}

/**
 * Sincroniza TODAS as guilds do bot de forma assíncrona
 * Não bloqueia a inicialização do bot
 */
export async function syncAllGuildMembers(client: Client<true>) {
  console.log('[MemberSync] 🚀 Sincronização iniciada em background...');

  const guilds = Array.from(client.guilds.cache.values());
  console.log(`[MemberSync] Total de guilds: ${guilds.length}`);

  for (const guild of guilds) {
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
