/**
 * Serviço otimizado para sincronização de membros
 * Usa estratégia progressiva para evitar rate limit e OOM
 */

import { Client } from 'discord.js';
import prisma from '../services/prisma';

/**
 * Sincroniza membros de forma PROGRESSIVA usando paginação do Discord
 * Evita buscar todos os 251k membros de uma vez
 */
export async function syncAllGuildMembers(client: Client<true>) {
  console.log('[MemberSync] 🚀 Sincronização progressiva iniciada...');
  console.log('[MemberSync] ℹ️  Dependemos principalmente dos eventos (guildMemberAdd/Remove)');
  console.log('[MemberSync] ℹ️  Esta sincronização é opcional e pode ser ignorada para guilds grandes');

  const guilds = Array.from(client.guilds.cache.values());
  console.log(`[MemberSync] Total de guilds: ${guilds.length}`);

  for (const guild of guilds) {
    try {
      console.log(`[MemberSync] 📊 ${guild.name} (${guild.memberCount} membros)`);

      // Para guilds muito grandes (>10k membros), pular sync completo
      // Confiar apenas nos eventos para popula tabela
      if (guild.memberCount > 10000) {
        console.log(`[MemberSync] ⏭️  Pulando ${guild.name} (muito grande, usando apenas eventos)`);
        continue;
      }

      // Para guilds menores, fazer sync progressivo com paginação
      console.log(`[MemberSync] 🔄 Sincronizando ${guild.name} progressivamente...`);

      const BATCH_SIZE = 1000; // Buscar 1000 por vez
      let after = '0';
      let totalSynced = 0;

      while (true) {
        try {
          // Fetch paginado do Discord
          const members = await guild.members.fetch({ limit: BATCH_SIZE, after });

          if (members.size === 0) break;

          // Processar batch
          const memberData = Array.from(members.values()).map((member) => ({
            guildId: guild.id,
            userId: member.user.id,
            username: member.user.username,
            tag: member.user.tag,
            displayName: member.displayName,
            avatarUrl: member.user.displayAvatarURL({ size: 256 }),
            isBot: member.user.bot,
            joinedAt: member.joinedAt,
          }));

          // Upsert em batch
          for (const data of memberData) {
            await prisma.currentMember.upsert({
              where: {
                guildId_userId: {
                  guildId: data.guildId,
                  userId: data.userId,
                },
              },
              update: {
                username: data.username,
                tag: data.tag,
                displayName: data.displayName,
                avatarUrl: data.avatarUrl,
                updatedAt: new Date(),
              },
              create: data,
            });
          }

          totalSynced += members.size;
          console.log(`[MemberSync] 📈 ${guild.name}: ${totalSynced} membros sincronizados`);

          // Preparar próximo batch
          const lastMember = Array.from(members.keys()).pop();
          if (!lastMember || members.size < BATCH_SIZE) break;
          after = lastMember;

          // Delay de 1 segundo entre batches para evitar rate limit
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error: any) {
          if (error.name === 'GatewayRateLimitError') {
            console.warn(`[MemberSync] ⏸️  Rate limit detectado, aguardando ${error.data?.retry_after}s...`);
            await new Promise((resolve) => setTimeout(resolve, error.data?.retry_after * 1000 + 1000));
          } else {
            throw error;
          }
        }
      }

      console.log(`[MemberSync] ✅ ${guild.name}: ${totalSynced} membros sincronizados`);
    } catch (error) {
      console.error(`[MemberSync] ❌ Erro em ${guild.name}:`, error);
      // Continuar com próxima guild mesmo se essa falhar
    }
  }

  console.log('[MemberSync] 🎉 Sincronização completa!');
}
