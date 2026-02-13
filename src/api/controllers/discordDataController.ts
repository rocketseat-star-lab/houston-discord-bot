import { Request, Response } from 'express';
import { Client } from 'discord.js';
import prisma from '../../services/prisma';

// Cache de membros para evitar rate limit do Discord
// Armazena o timestamp da última vez que os membros foram buscados
const membersFetchCache = new Map<string, number>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos em milissegundos

/**
 * GET /api/v1/discord-data/guilds
 * Retorna todos os servidores (guilds) que o bot está presente
 */
export const getAvailableGuilds = async (req: Request, res: Response) => {
  try {
    const discordClient = req.app.get('discordClient') as Client;

    if (!discordClient || !discordClient.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'Discord client not ready',
      });
    }

    const guilds = Array.from(discordClient.guilds.cache.values()).map((guild) => ({
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL({ size: 256 }),
      memberCount: guild.memberCount,
      ownerId: guild.ownerId,
    }));

    console.log(`[getAvailableGuilds] Retornando ${guilds.length} guilds`);

    return res.status(200).json({
      success: true,
      data: {
        guilds,
        total: guilds.length,
      },
    });
  } catch (error) {
    console.error('[getAvailableGuilds] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * GET /api/v1/discord-data/members/new
 * Retorna novos joins e leaves desde um timestamp específico
 * Query params: guildId (required), since (timestamp ISO)
 */
export const getNewJoinsLeaves = async (req: Request, res: Response) => {
  try {
    const guildId = req.query.guildId as string;
    const since = req.query.since as string | undefined;

    if (!guildId) {
      return res.status(400).json({
        success: false,
        error: 'guildId is required',
      });
    }

    const sinceDate = since ? new Date(since) : new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [joins, leaves] = await Promise.all([
      prisma.memberJoinLog.findMany({
        where: {
          guildId,
          joinedAt: {
            gte: sinceDate,
          },
        },
        orderBy: { joinedAt: 'desc' },
      }),
      prisma.memberLeaveLog.findMany({
        where: {
          guildId,
          leftAt: {
            gte: sinceDate,
          },
        },
        orderBy: { leftAt: 'desc' },
      }),
    ]);

    console.log(
      `[DiscordDataController] Retornando ${joins.length} joins e ${leaves.length} leaves desde ${sinceDate.toISOString()}`
    );

    return res.status(200).json({
      success: true,
      data: {
        joins,
        leaves,
      },
    });
  } catch (error) {
    console.error('[DiscordDataController] Error in getNewJoinsLeaves:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * GET /api/v1/discord-data/messages/aggregate
 * Retorna agregações de mensagens
 * Query params: guildId (required), since (timestamp), groupBy='day'
 */
export const getMessageAggregates = async (req: Request, res: Response) => {
  try {
    const guildId = req.query.guildId as string;
    const since = req.query.since as string | undefined;
    const groupBy = (req.query.groupBy as string) || 'day';

    if (!guildId) {
      return res.status(400).json({
        success: false,
        error: 'guildId is required',
      });
    }

    const sinceDate = since ? new Date(since) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Agregação por canal
    const byChannel = await prisma.messageLog.groupBy({
      by: ['channelId'],
      where: {
        guildId,
        createdAt: {
          gte: sinceDate,
        },
      },
      _count: {
        id: true,
      },
      _sum: {
        characterCount: true,
        wordCount: true,
      },
    });

    // Agregação por usuário
    const byUser = await prisma.messageLog.groupBy({
      by: ['userId', 'username'],
      where: {
        guildId,
        createdAt: {
          gte: sinceDate,
        },
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 50, // Top 50 usuários
    });

    // Total de mensagens
    const total = await prisma.messageLog.count({
      where: {
        guildId,
        createdAt: {
          gte: sinceDate,
        },
      },
    });

    console.log(`[DiscordDataController] Retornando agregações de ${total} mensagens`);

    return res.status(200).json({
      success: true,
      data: {
        byChannel: byChannel.map(c => ({
          channelId: c.channelId,
          messageCount: c._count.id,
          totalCharacters: c._sum.characterCount || 0,
          totalWords: c._sum.wordCount || 0,
        })),
        byUser: byUser.map(u => ({
          userId: u.userId,
          username: u.username,
          messageCount: u._count.id,
        })),
        total,
      },
    });
  } catch (error) {
    console.error('[DiscordDataController] Error in getMessageAggregates:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * GET /api/v1/discord-data/voice/aggregate
 * Retorna agregações de atividade de voz
 * Query params: guildId (required), since (timestamp)
 */
export const getVoiceAggregates = async (req: Request, res: Response) => {
  try {
    const guildId = req.query.guildId as string;
    const since = req.query.since as string | undefined;

    if (!guildId) {
      return res.status(400).json({
        success: false,
        error: 'guildId is required',
      });
    }

    const sinceDate = since ? new Date(since) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Agregação por canal
    const byChannel = await prisma.voiceActivityLog.groupBy({
      by: ['channelId'],
      where: {
        guildId,
        joinedAt: {
          gte: sinceDate,
        },
        leftAt: {
          not: null,
        },
      },
      _sum: {
        durationSec: true,
      },
      _count: {
        id: true,
      },
    });

    // Agregação por usuário
    const byUser = await prisma.voiceActivityLog.groupBy({
      by: ['userId', 'username'],
      where: {
        guildId,
        joinedAt: {
          gte: sinceDate,
        },
        leftAt: {
          not: null,
        },
      },
      _sum: {
        durationSec: true,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _sum: {
          durationSec: 'desc',
        },
      },
      take: 50, // Top 50 usuários
    });

    // Total de minutos de voz
    const totalResult = await prisma.voiceActivityLog.aggregate({
      where: {
        guildId,
        joinedAt: {
          gte: sinceDate,
        },
        leftAt: {
          not: null,
        },
      },
      _sum: {
        durationSec: true,
      },
    });

    const totalMinutes = Math.floor((totalResult._sum.durationSec || 0) / 60);

    console.log(`[DiscordDataController] Retornando agregações de voz: ${totalMinutes} minutos totais`);

    return res.status(200).json({
      success: true,
      data: {
        byChannel: byChannel.map(c => ({
          channelId: c.channelId,
          sessionCount: c._count.id,
          totalMinutes: Math.floor((c._sum.durationSec || 0) / 60),
        })),
        byUser: byUser.map(u => ({
          userId: u.userId,
          username: u.username,
          sessionCount: u._count.id,
          totalMinutes: Math.floor((u._sum.durationSec || 0) / 60),
        })),
        totalMinutes,
      },
    });
  } catch (error) {
    console.error('[DiscordDataController] Error in getVoiceAggregates:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * GET /api/v1/discord-data/reactions/aggregate
 * Retorna agregações de reações
 * Query params: guildId (required), since (timestamp)
 */
export const getReactionAggregates = async (req: Request, res: Response) => {
  try {
    const guildId = req.query.guildId as string;
    const since = req.query.since as string | undefined;

    if (!guildId) {
      return res.status(400).json({
        success: false,
        error: 'guildId is required',
      });
    }

    const sinceDate = since ? new Date(since) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Agregação por emoji
    const byEmoji = await prisma.reactionLog.groupBy({
      by: ['emojiName', 'isCustom'],
      where: {
        guildId,
        addedAt: {
          gte: sinceDate,
        },
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 50, // Top 50 emojis
    });

    // Agregação por canal
    const byChannel = await prisma.reactionLog.groupBy({
      by: ['channelId'],
      where: {
        guildId,
        addedAt: {
          gte: sinceDate,
        },
      },
      _count: {
        id: true,
      },
    });

    // Agregação por usuário
    const byUser = await prisma.reactionLog.groupBy({
      by: ['userId'],
      where: {
        guildId,
        addedAt: {
          gte: sinceDate,
        },
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 50, // Top 50 usuários
    });

    // Total
    const total = await prisma.reactionLog.count({
      where: {
        guildId,
        addedAt: {
          gte: sinceDate,
        },
      },
    });

    console.log(`[DiscordDataController] Retornando agregações de ${total} reações`);

    return res.status(200).json({
      success: true,
      data: {
        byEmoji: byEmoji.map(e => ({
          emojiName: e.emojiName,
          isCustom: e.isCustom,
          count: e._count.id,
        })),
        byChannel: byChannel.map(c => ({
          channelId: c.channelId,
          count: c._count.id,
        })),
        byUser: byUser.map(u => ({
          userId: u.userId,
          count: u._count.id,
        })),
        total,
      },
    });
  } catch (error) {
    console.error('[DiscordDataController] Error in getReactionAggregates:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * GET /api/v1/discord-data/users/:userId/profile
 * Retorna perfil completo e granular de um usuário
 * Params: userId (URL)
 * Query params: guildId (required), startDate?, endDate?
 */
export const getUserProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;
    const guildId = req.query.guildId as string;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    if (!guildId) {
      return res.status(400).json({
        success: false,
        error: 'guildId is required',
      });
    }

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    console.log(`[getUserProfile] Buscando perfil de ${userId} no guild ${guildId}`);
    console.log(`[getUserProfile] Período: ${start.toISOString()} até ${end.toISOString()}`);

    // Buscar todas as atividades do usuário em paralelo
    const [allMessages, voice, reactions, bans, timeouts, joinHistory] = await Promise.all([
      // TODAS as mensagens (para agregar por canal)
      prisma.messageLog.findMany({
        where: {
          guildId,
          userId,
          createdAt: {
            gte: start,
            lte: end,
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      // Voz (últimas 50 sessões)
      prisma.voiceActivityLog.findMany({
        where: {
          guildId,
          userId,
          joinedAt: {
            gte: start,
            lte: end,
          },
        },
        orderBy: { joinedAt: 'desc' },
        take: 50,
      }),
      // Reações (últimas 100)
      prisma.reactionLog.findMany({
        where: {
          guildId,
          userId,
          addedAt: {
            gte: start,
            lte: end,
          },
        },
        orderBy: { addedAt: 'desc' },
        take: 100,
      }),
      // Bans
      prisma.moderationBan.findMany({
        where: {
          guildId,
          userId,
        },
        orderBy: { bannedAt: 'desc' },
      }),
      // Timeouts
      prisma.moderationTimeout.findMany({
        where: {
          guildId,
          userId,
        },
        orderBy: { appliedAt: 'desc' },
      }),
      // Histórico de entrada
      prisma.memberJoinLog.findMany({
        where: {
          guildId,
          userId,
        },
        orderBy: { joinedAt: 'desc' },
      }),
    ]);

    // Buscar informações atuais do membro do cache no banco (evita rate limiting)
    let currentMember = null;
    const cachedMember = await prisma.currentMember.findUnique({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
      },
    });

    if (cachedMember) {
      currentMember = {
        userId: cachedMember.userId,
        username: cachedMember.username,
        tag: cachedMember.tag,
        displayName: cachedMember.displayName,
        avatarUrl: cachedMember.avatarUrl,
        isBot: cachedMember.isBot,
        joinedAt: cachedMember.joinedAt?.toISOString() || null,
      };
    } else if (joinHistory.length > 0) {
      // Fallback: usar dados mais recentes do joinHistory se não estiver no cache
      const latest = joinHistory[0];
      currentMember = {
        userId: latest.userId,
        username: latest.username || userId,
        tag: latest.username || userId, // fallback
        displayName: latest.username || userId,
        avatarUrl: latest.avatarUrl || null,
        isBot: latest.isBot || false,
        joinedAt: latest.joinedAt.toISOString(),
      };
    } else {
      // Último fallback: buscar diretamente do Discord se disponível
      try {
        const client = (req.app as any).get('discordClient');
        const guild = await client.guilds.fetch(guildId as string);
        const discordMember = await guild.members.fetch(userId).catch(() => null);

        if (discordMember) {
          currentMember = {
            userId: discordMember.user.id,
            username: discordMember.user.username,
            tag: discordMember.user.tag,
            displayName: discordMember.displayName,
            avatarUrl: discordMember.user.displayAvatarURL({ size: 256 }),
            isBot: discordMember.user.bot,
            joinedAt: discordMember.joinedAt?.toISOString() || null,
          };
        }
      } catch (error) {
        console.error(`[getUserProfile] Erro ao buscar membro do Discord: ${error}`);
      }
    }

    // Agregar mensagens por canal
    const messagesByChannel = allMessages.reduce((acc, msg) => {
      if (!acc[msg.channelId]) {
        acc[msg.channelId] = [];
      }
      acc[msg.channelId].push(msg);
      return acc;
    }, {} as Record<string, typeof allMessages>);

    // Buscar informações dos canais do Discord
    const client = (req.app as any).get('discordClient');
    const channelInfoMap: Record<string, { id: string; name: string; count: number }> = {};

    try {
      const guild = await client.guilds.fetch(guildId as string);
      const channelIds = Object.keys(messagesByChannel);

      await Promise.all(
        channelIds.map(async (channelId) => {
          try {
            const channel = await guild.channels.fetch(channelId).catch(() => null);
            channelInfoMap[channelId] = {
              id: channelId,
              name: channel?.name || `Canal ${channelId.substring(0, 8)}...`,
              count: messagesByChannel[channelId].length,
            };
          } catch (error) {
            channelInfoMap[channelId] = {
              id: channelId,
              name: `Canal ${channelId.substring(0, 8)}...`,
              count: messagesByChannel[channelId].length,
            };
          }
        })
      );
    } catch (error) {
      console.error('[getUserProfile] Erro ao buscar canais:', error);
      // Fallback: usar IDs
      Object.keys(messagesByChannel).forEach((channelId) => {
        channelInfoMap[channelId] = {
          id: channelId,
          name: `Canal ${channelId.substring(0, 8)}...`,
          count: messagesByChannel[channelId].length,
        };
      });
    }

    // Ordenar canais por número de mensagens (decrescente)
    const messagesByChannelAggregated = Object.values(channelInfoMap).sort((a, b) => b.count - a.count);

    // Pegar últimas 10 mensagens com informações de canal
    const recentMessages = allMessages.slice(0, 10).map((msg) => ({
      id: msg.id.toString(),
      messageId: msg.messageId,
      channelId: msg.channelId,
      channelName: channelInfoMap[msg.channelId]?.name || 'Canal desconhecido',
      createdAt: msg.createdAt.toISOString(),
      hasAttachments: msg.hasAttachments,
      hasLinks: msg.hasLinks,
      hasMentions: msg.hasMentions,
      characterCount: msg.characterCount,
      wordCount: msg.wordCount,
    }));

    // Calcular estatísticas
    const totalMessages = allMessages.length;
    const totalVoiceMinutes = voice.reduce((acc, v) => acc + (v.durationSec || 0), 0) / 60;
    const totalReactions = reactions.length;
    const banCount = bans.length;
    const timeoutCount = timeouts.length;

    console.log(
      `[getUserProfile] Perfil de ${userId} (${currentMember?.displayName || 'Desconhecido'}):`,
      `${totalMessages} msgs, ${Math.floor(totalVoiceMinutes)} min voz, ${totalReactions} reações,`,
      `${banCount} bans, ${timeoutCount} timeouts, ${joinHistory.length} joins`,
      `| Member: ${currentMember ? 'OK' : 'NULL'}`
    );

    return res.status(200).json({
      success: true,
      data: {
        member: currentMember, // Informações atuais do membro
        messages: recentMessages, // Últimas 10 mensagens com nome do canal
        messagesByChannel: messagesByChannelAggregated, // Agregação por canal
        voice,
        reactions,
        moderation: {
          bans,
          timeouts,
        },
        joinHistory,
        stats: {
          totalMessages,
          totalVoiceMinutes: Math.floor(totalVoiceMinutes),
          totalReactions,
          banCount,
          timeoutCount,
        },
      },
    });
  } catch (error) {
    console.error('[DiscordDataController] Error in getUserProfile:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * GET /api/v1/discord-data/users/:userId/moderation
 * Retorna histórico completo de moderação de um usuário
 * Params: userId (URL)
 * Query params: guildId (required)
 */
export const getModerationHistory = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;
    const guildId = req.query.guildId as string;

    if (!guildId) {
      return res.status(400).json({
        success: false,
        error: 'guildId is required',
      });
    }

    const [bans, timeouts] = await Promise.all([
      prisma.moderationBan.findMany({
        where: {
          guildId,
          userId,
        },
        orderBy: { bannedAt: 'desc' },
      }),
      prisma.moderationTimeout.findMany({
        where: {
          guildId,
          userId,
        },
        orderBy: { appliedAt: 'desc' },
      }),
    ]);

    console.log(
      `[DiscordDataController] Retornando histórico de moderação de ${userId}: ${bans.length} bans, ${timeouts.length} timeouts`
    );

    return res.status(200).json({
      success: true,
      data: {
        bans,
        timeouts,
      },
    });
  } catch (error) {
    console.error('[DiscordDataController] Error in getModerationHistory:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * GET /api/v1/discord-data/guilds/:guildId/members
 * Retorna todos os membros atuais do servidor via Discord API
 * Query params: search (optional), isBot (optional), limit (optional)
 */
export const getCurrentMembers = async (req: Request, res: Response) => {
  try {
    const guildId = req.params.guildId as string;
    const search = req.query.search as string | undefined;
    const isBot = req.query.isBot as string | undefined;
    const limit = req.query.limit as string | undefined;

    if (!guildId) {
      return res.status(400).json({
        success: false,
        error: 'guildId is required',
      });
    }

    const discordClient = req.app.get('discordClient') as Client;

    if (!discordClient || !discordClient.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'Discord client not ready',
      });
    }

    // Debug: listar todas as guilds disponíveis
    console.log('[getCurrentMembers] Guilds disponíveis:',
      Array.from(discordClient.guilds.cache.values()).map(g => ({ id: g.id, name: g.name }))
    );
    console.log('[getCurrentMembers] Procurando guild:', guildId);

    // Buscar guild
    const guild = discordClient.guilds.cache.get(guildId);

    if (!guild) {
      return res.status(404).json({
        success: false,
        error: 'Guild not found',
        availableGuilds: Array.from(discordClient.guilds.cache.values()).map(g => ({ id: g.id, name: g.name })),
      });
    }

    // Verificar cache antes de fazer fetch (evita rate limit)
    const now = Date.now();
    const lastFetch = membersFetchCache.get(guildId);
    const shouldFetch = !lastFetch || (now - lastFetch) > CACHE_TTL;

    if (shouldFetch) {
      console.log(`[getCurrentMembers] Cache expirado ou não existe, fazendo fetch de membros para guild ${guildId}`);
      try {
        await guild.members.fetch();
        membersFetchCache.set(guildId, now);
      } catch (error: any) {
        // Se houver rate limit, usar cache existente
        if (error.name === 'GatewayRateLimitError') {
          console.warn(`[getCurrentMembers] Rate limit detectado, usando cache existente. Retry after: ${error.data?.retry_after}s`);
        } else {
          throw error; // Re-lançar outros erros
        }
      }
    } else {
      const cacheAge = Math.floor((now - lastFetch) / 1000);
      console.log(`[getCurrentMembers] Usando cache de membros (${cacheAge}s atrás)`);
    }

    // Filtrar membros
    let members = Array.from(guild.members.cache.values());

    // Filtro por bot
    if (isBot !== undefined) {
      const isBotFilter = isBot === 'true';
      members = members.filter((m) => m.user.bot === isBotFilter);
    }

    // Filtro por busca (username, tag, displayName, ID)
    if (search) {
      const searchLower = (search as string).toLowerCase();
      const searchStr = search as string;
      members = members.filter(
        (m) =>
          m.user.username.toLowerCase().includes(searchLower) ||
          m.user.tag.toLowerCase().includes(searchLower) ||
          m.displayName.toLowerCase().includes(searchLower) ||
          m.user.id.includes(searchStr) // Busca por ID (parcial ou completo)
      );
    }

    // Limitar resultados
    const limitNumber = limit ? parseInt(limit as string, 10) : 100;
    members = members.slice(0, limitNumber);

    // Mapear para formato de resposta
    const membersData = members.map((member) => ({
      userId: member.user.id,
      username: member.user.username,
      tag: member.user.tag,
      displayName: member.displayName,
      avatarUrl: member.user.displayAvatarURL({ size: 256 }),
      isBot: member.user.bot,
      joinedAt: member.joinedAt?.toISOString() || null,
      roles: member.roles.cache.map((role) => ({
        id: role.id,
        name: role.name,
        color: role.hexColor,
      })),
    }));

    console.log(
      `[DiscordDataController] Retornando ${membersData.length} membros atuais do guild ${guildId}`
    );

    return res.status(200).json({
      success: true,
      data: {
        members: membersData,
        total: guild.memberCount,
        fetched: membersData.length,
      },
    });
  } catch (error) {
    console.error('[DiscordDataController] Error in getCurrentMembers:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * POST /api/v1/discord-data/guilds/:guildId/populate-join-history
 * Popula a tabela MemberJoinLog com base nos membros atuais do servidor
 * Útil para criar histórico de membros que entraram enquanto o bot estava offline
 */
export const populateJoinHistory = async (req: Request, res: Response) => {
  try {
    const guildId = req.params.guildId as string;

    if (!guildId) {
      return res.status(400).json({
        success: false,
        error: 'guildId is required',
      });
    }

    const discordClient = req.app.get('discordClient') as Client;

    if (!discordClient || !discordClient.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'Discord client not ready',
      });
    }

    const guild = discordClient.guilds.cache.get(guildId);

    if (!guild) {
      return res.status(404).json({
        success: false,
        error: 'Guild not found',
      });
    }

    console.log(`[populateJoinHistory] Populando histórico de entrada para guild ${guild.name} (${guildId})`);

    // Buscar todos os membros do servidor
    await guild.members.fetch();
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
            guildId,
            userId: member.user.id,
          },
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Criar registro de entrada
        if (member.joinedAt) {
          await prisma.memberJoinLog.create({
            data: {
              guildId,
              userId: member.user.id,
              username: member.user.tag,
              avatarUrl: member.user.displayAvatarURL({ size: 256 }),
              joinedAt: member.joinedAt,
              isBot: member.user.bot,
            },
          });
          created++;
        } else {
          // Se não tiver joinedAt, pular
          skipped++;
        }
      } catch (error) {
        console.error(`[populateJoinHistory] Erro ao processar membro ${member.user.tag}:`, error);
        errors++;
      }
    }

    console.log(
      `[populateJoinHistory] Concluído: ${created} criados, ${skipped} pulados, ${errors} erros`
    );

    return res.status(200).json({
      success: true,
      data: {
        created,
        skipped,
        errors,
        total: members.length,
      },
    });
  } catch (error) {
    console.error('[populateJoinHistory] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};
