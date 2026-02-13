/**
 * Serviço de sincronização de membros
 * Usa REST API do Discord com paginação REAL - NÃO carrega tudo na memória
 */

import { Client } from 'discord.js';
import prisma from '../services/prisma';

const FETCH_LIMIT = 500; // Reduzido para economizar memória
const DB_BATCH_SIZE = 250; // Reduzido para economizar memória
const PAGE_DELAY = 2000; // Delay maior entre páginas para GC

interface DiscordMember {
  user: {
    id: string;
    username: string;
    discriminator: string;
    avatar: string | null;
    bot?: boolean;
  };
  nick: string | null;
  joined_at: string;
}

/**
 * Sincroniza membros de UMA guild usando REST API com paginação
 * NÃO carrega tudo na memória - processa em chunks
 */
async function syncGuildMembers(client: Client<true>, guildId: string): Promise<number> {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    console.error(`[MemberSync] Guild ${guildId} não encontrada`);
    return 0;
  }

  console.log(`[MemberSync] 📊 Iniciando ${guild.name} (${guild.memberCount} membros)`);
  console.log(`[MemberSync] ℹ️  Usando REST API com paginação - memória controlada`);
  const startTime = Date.now();

  let totalSynced = 0;
  let after = '0'; // ID do último membro da página anterior

  try {
    while (true) {
      // Fetch paginado via REST API (NÃO usa Gateway, NÃO carrega tudo)
      console.log(`[MemberSync] 📥 Fetching batch (after: ${after.substring(0, 8)}...)`);

      const members = (await client.rest.get(
        `/guilds/${guildId}/members`,
        { query: new URLSearchParams({ limit: FETCH_LIMIT.toString(), after }) }
      )) as DiscordMember[];

      if (!members || members.length === 0) {
        console.log(`[MemberSync] ✅ Fim da paginação - sem mais membros`);
        break;
      }

      console.log(`[MemberSync] 📦 ${members.length} membros recebidos`);

      // Processar em batches menores para inserção no banco
      for (let i = 0; i < members.length; i += DB_BATCH_SIZE) {
        const batchMembers = members.slice(i, i + DB_BATCH_SIZE);

        const memberData = batchMembers.map((member) => ({
          guildId,
          userId: member.user.id,
          username: member.user.username,
          tag: `${member.user.username}#${member.user.discriminator}`,
          displayName: member.nick || member.user.username,
          avatarUrl: member.user.avatar
            ? `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png`
            : `https://cdn.discordapp.com/embed/avatars/${parseInt(member.user.discriminator) % 5}.png`,
          isBot: member.user.bot || false,
          joinedAt: new Date(member.joined_at),
        }));

        // Batch insert
        try {
          await prisma.currentMember.createMany({
            data: memberData,
            skipDuplicates: true,
          });

          totalSynced += batchMembers.length;
        } catch (error) {
          console.error(`[MemberSync] ❌ Erro ao salvar batch:`, error);
        }
      }

      const progress = ((totalSynced / guild.memberCount) * 100).toFixed(1);
      console.log(`[MemberSync] 💾 ${progress}% - ${totalSynced}/${guild.memberCount} membros salvos`);

      // Se recebemos menos que o limite, acabou
      if (members.length < FETCH_LIMIT) {
        console.log(`[MemberSync] ✅ Última página recebida`);
        break;
      }

      // Preparar próxima página
      after = members[members.length - 1].user.id;

      // Limpar array para liberar memória
      members.length = 0;

      // Delay maior para garbage collection
      await new Promise((resolve) => setTimeout(resolve, PAGE_DELAY));

      // Forçar garbage collection se disponível
      if (global.gc) {
        global.gc();
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[MemberSync] ✅ ${guild.name}: ${totalSynced} membros em ${duration}s`);
    return totalSynced;

  } catch (error: any) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[MemberSync] ❌ Erro em ${guild.name} após ${duration}s:`, error);
    return totalSynced;
  }
}

/**
 * Sincroniza TODAS as guilds do bot
 */
export async function syncAllGuildMembers(client: Client<true>) {
  console.log('[MemberSync] 🚀 Sincronização iniciada...');

  const guilds = Array.from(client.guilds.cache.values());
  console.log(`[MemberSync] Total de guilds: ${guilds.length}`);

  for (const guild of guilds) {
    await syncGuildMembers(client, guild.id);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log('[MemberSync] 🎉 Sincronização completa!');
}

/**
 * Exporta função para sincronizar guild específica
 */
export async function syncSingleGuild(client: Client<true>, guildId: string): Promise<number> {
  return syncGuildMembers(client, guildId);
}
