import { Client } from 'discord.js';
import prisma from './prisma';

/**
 * Popula a tabela MemberJoinLog com os membros atuais de todos os servidores
 * Chamado automaticamente quando o bot inicializa para garantir que o histórico esteja completo
 */
export async function populateJoinHistoryOnStartup(client: Client) {
  if (!client.isReady()) {
    console.warn('[populateJoinHistoryOnStartup] Discord client not ready, skipping...');
    return;
  }

  const guilds = Array.from(client.guilds.cache.values());
  console.log(`[populateJoinHistoryOnStartup] Populando histórico de entrada para ${guilds.length} servidor(es)...`);

  for (const guild of guilds) {
    try {
      console.log(`[populateJoinHistoryOnStartup] Processando guild ${guild.name} (${guild.id})...`);

      // Usar membros já em cache (já foram fetched pelo member sync)
      // NÃO fazer fetch aqui para evitar rate limiting
      const members = Array.from(guild.members.cache.values());

      let created = 0;
      let skipped = 0;
      let errors = 0;

      // Para cada membro, verificar se já tem registro e criar se não tiver
      for (const member of members) {
        try {
          // Verificar se já existe registro para este membro
          const existing = await prisma.memberJoinLog.findFirst({
            where: {
              guildId: guild.id,
              userId: member.user.id,
            },
          });

          if (existing) {
            skipped++;
            continue;
          }

          // Se não existir e temos a data de entrada, criar registro
          if (member.joinedAt) {
            await prisma.memberJoinLog.create({
              data: {
                guildId: guild.id,
                userId: member.user.id,
                username: member.user.tag,
                avatarUrl: member.user.displayAvatarURL({ size: 256 }),
                joinedAt: member.joinedAt,
                isBot: member.user.bot,
              },
            });
            created++;
          } else {
            // Se não temos a data de entrada, pular
            skipped++;
          }
        } catch (error) {
          console.error(`[populateJoinHistoryOnStartup] Erro ao processar membro ${member.user.tag}:`, error);
          errors++;
        }
      }

      console.log(
        `[populateJoinHistoryOnStartup] Guild ${guild.name}: ${created} criados, ${skipped} pulados, ${errors} erros`
      );
    } catch (error) {
      console.error(`[populateJoinHistoryOnStartup] Erro ao processar guild ${guild.name}:`, error);
    }
  }

  console.log('[populateJoinHistoryOnStartup] ✅ Histórico de entrada populado com sucesso!');
}
