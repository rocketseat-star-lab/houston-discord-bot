import { Request, Response } from 'express';
import { Client, ChannelType } from 'discord.js';

/**
 * Lista todos os servidores (guilds) em que o bot está, incluindo seus canais.
 */
export async function listGuilds(req: Request, res: Response) {
  const discordClient = req.app.get('discordClient') as Client;

  if (!discordClient || !discordClient.isReady()) {
    return res.status(503).json({ error: 'O cliente do Discord não está pronto ou disponível.' });
  }

  try {
    const guildsData = await Promise.all(
      discordClient.guilds.cache.map(async guild => {
        const channels = await guild.channels.fetch();

        const channelsList = channels
          .filter(channel => channel !== null)
          .map(channel => ({
            id: channel!.id,
            name: channel!.name,
            type: channel!.type,
            typeName: ChannelType[channel!.type],
            position: channel!.position,
            parentId: channel!.parentId,
          }))
          .sort((a, b) => {
            const channelA = channels.get(a.id);
            const channelB = channels.get(b.id);
            return (channelA?.position ?? 0) - (channelB?.position ?? 0);
          });

        return {
          id: guild.id,
          name: guild.name,
          iconURL: guild.iconURL(),
          channels: channelsList,
        };
      })
    );

    res.status(200).json(guildsData);
  } catch (error) {
    console.error('Erro ao buscar servidores:', error);
    res.status(500).json({ error: 'Erro interno do servidor ao processar a lista de servidores.' });
  }
}

/**
 * Lista apenas os canais de fórum de um servidor.
 */
export async function listForumChannels(req: Request, res: Response) {
  const discordClient = req.app.get('discordClient') as Client;
  const { guildId } = req.params;

  if (!discordClient || !discordClient.isReady()) {
    return res.status(503).json({ error: 'O cliente do Discord não está pronto ou disponível.' });
  }

  try {
    const guild = discordClient.guilds.cache.get(guildId);

    if (!guild) {
      return res.status(404).json({ error: 'Servidor não encontrado.' });
    }

    const channels = await guild.channels.fetch();

    // Retorna apenas canais do tipo fórum
    const forumChannels: { id: string; name: string; type: number; typeName: string }[] = [];

    channels.forEach(channel => {
      if (!channel) return;
      if (channel.type !== ChannelType.GuildForum) return;

      forumChannels.push({
        id: channel.id,
        name: channel.name,
        type: channel.type,
        typeName: ChannelType[channel.type],
      });
    });

    // Ordena por posição
    forumChannels.sort((a, b) => {
      const channelA = channels.get(a.id);
      const channelB = channels.get(b.id);
      return (channelA?.position ?? 0) - (channelB?.position ?? 0);
    });

    res.status(200).json({ channels: forumChannels });
  } catch (error) {
    console.error('Erro ao buscar canais de fórum:', error);
    res.status(500).json({ error: 'Erro interno do servidor ao processar a lista de canais.' });
  }
}

/**
 * Lista todas as roles de um servidor
 */
export async function listGuildRoles(req: Request, res: Response) {
  const discordClient = req.app.get('discordClient') as Client;
  const { guildId } = req.params;

  if (!discordClient || !discordClient.isReady()) {
    return res.status(503).json({ error: 'O cliente do Discord não está pronto ou disponível.' });
  }

  try {
    const guild = discordClient.guilds.cache.get(guildId);

    if (!guild) {
      return res.status(404).json({ error: 'Servidor não encontrado.' });
    }

    const roles = await guild.roles.fetch();

    // Roles especiais do Discord (não são roles reais, mas menções especiais)
    const specialRoles = [
      {
        id: 'everyone',
        name: 'everyone',
        color: '#99AAB5',
        position: -1,
        managed: false,
        special: true
      },
      {
        id: 'here',
        name: 'here',
        color: '#99AAB5',
        position: -2,
        managed: false,
        special: true
      }
    ];

    const rolesList = roles
      .filter(role => role !== null && role.name !== '@everyone')
      .map(role => ({
        id: role!.id,
        name: role!.name,
        color: role!.hexColor,
        position: role!.position,
        managed: role!.managed,
        special: false
      }))
      .sort((a, b) => b.position - a.position);

    // Adicionar roles especiais no início
    const allRoles = [...specialRoles, ...rolesList];

    console.log(`[listGuildRoles] Guild ${guildId}: returning ${allRoles.length} roles (${rolesList.length} regular + 2 special)`);

    res.status(200).json({ roles: allRoles });
  } catch (error) {
    console.error('Erro ao buscar roles:', error);
    res.status(500).json({ error: 'Erro interno do servidor ao processar a lista de roles.' });
  }
}

/**
 * Lista todos os canais de um servidor (text, voice, announcement, etc.)
 */
export async function listGuildChannels(req: Request, res: Response) {
  const discordClient = req.app.get('discordClient') as Client;
  const { guildId } = req.params;

  if (!discordClient || !discordClient.isReady()) {
    return res.status(503).json({ error: 'O cliente do Discord não está pronto ou disponível.' });
  }

  try {
    const guild = discordClient.guilds.cache.get(guildId);

    if (!guild) {
      return res.status(404).json({ error: 'Servidor não encontrado.' });
    }

    const channels = await guild.channels.fetch();

    const channelsList = channels
      .filter(channel => channel !== null)
      .map(channel => ({
        id: channel!.id,
        name: channel!.name,
        type: channel!.type,
        typeName: ChannelType[channel!.type],
        position: channel!.position,
        parentId: channel!.parentId,
      }))
      .sort((a, b) => a.position - b.position);

    res.status(200).json({ channels: channelsList });
  } catch (error) {
    console.error('Erro ao buscar canais:', error);
    res.status(500).json({ error: 'Erro interno do servidor ao processar a lista de canais.' });
  }
}

/**
 * Lista todos os emojis disponíveis em um servidor
 */
export async function listGuildEmojis(req: Request, res: Response) {
  const discordClient = req.app.get('discordClient') as Client;
  const { guildId } = req.params;

  if (!discordClient || !discordClient.isReady()) {
    return res.status(503).json({ error: 'O cliente do Discord não está pronto ou disponível.' });
  }

  try {
    const guild = discordClient.guilds.cache.get(guildId);

    if (!guild) {
      return res.status(404).json({ error: 'Servidor não encontrado.' });
    }

    // Buscar todos os emojis customizados do servidor
    const emojis = await guild.emojis.fetch();

    const customEmojisList = emojis
      .filter(emoji => emoji !== null)
      .map(emoji => ({
        id: emoji!.id,
        name: emoji!.name,
        animated: emoji!.animated,
        identifier: emoji!.animated ? `<a:${emoji!.name}:${emoji!.id}>` : `<:${emoji!.name}:${emoji!.id}>`,
        url: emoji!.url,
        custom: true
      }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    // Emojis Unicode padrão mais usados
    const unicodeEmojis = [
      // Mais usados (prioridade)
      { id: 'unicode_purple_heart', name: 'purple_heart', animated: false, identifier: '💜', url: null, custom: false },
      { id: 'unicode_rocket', name: 'rocket', animated: false, identifier: '🚀', url: null, custom: false },
      { id: 'unicode_fire', name: 'fire', animated: false, identifier: '🔥', url: null, custom: false },

      // Reações básicas
      { id: 'unicode_thumbsup', name: 'thumbsup', animated: false, identifier: '👍', url: null, custom: false },
      { id: 'unicode_thumbsdown', name: 'thumbsdown', animated: false, identifier: '👎', url: null, custom: false },
      { id: 'unicode_clap', name: 'clap', animated: false, identifier: '👏', url: null, custom: false },
      { id: 'unicode_raised_hands', name: 'raised_hands', animated: false, identifier: '🙌', url: null, custom: false },
      { id: 'unicode_pray', name: 'pray', animated: false, identifier: '🙏', url: null, custom: false },
      { id: 'unicode_ok_hand', name: 'ok_hand', animated: false, identifier: '👌', url: null, custom: false },
      { id: 'unicode_wave', name: 'wave', animated: false, identifier: '👋', url: null, custom: false },

      // Corações
      { id: 'unicode_heart', name: 'heart', animated: false, identifier: '❤️', url: null, custom: false },
      { id: 'unicode_blue_heart', name: 'blue_heart', animated: false, identifier: '💙', url: null, custom: false },
      { id: 'unicode_green_heart', name: 'green_heart', animated: false, identifier: '💚', url: null, custom: false },
      { id: 'unicode_yellow_heart', name: 'yellow_heart', animated: false, identifier: '💛', url: null, custom: false },
      { id: 'unicode_orange_heart', name: 'orange_heart', animated: false, identifier: '🧡', url: null, custom: false },

      // Símbolos e objetos
      { id: 'unicode_dart', name: 'dart', animated: false, identifier: '🎯', url: null, custom: false },
      { id: 'unicode_pushpin', name: 'pushpin', animated: false, identifier: '📌', url: null, custom: false },
      { id: 'unicode_tada', name: 'tada', animated: false, identifier: '🎉', url: null, custom: false },
      { id: 'unicode_star', name: 'star', animated: false, identifier: '⭐', url: null, custom: false },
      { id: 'unicode_sparkles', name: 'sparkles', animated: false, identifier: '✨', url: null, custom: false },
      { id: 'unicode_zap', name: 'zap', animated: false, identifier: '⚡', url: null, custom: false },
      { id: 'unicode_boom', name: 'boom', animated: false, identifier: '💥', url: null, custom: false },

      // Rostos
      { id: 'unicode_smile', name: 'smile', animated: false, identifier: '😊', url: null, custom: false },
      { id: 'unicode_laughing', name: 'laughing', animated: false, identifier: '😆', url: null, custom: false },
      { id: 'unicode_joy', name: 'joy', animated: false, identifier: '😂', url: null, custom: false },
      { id: 'unicode_rofl', name: 'rofl', animated: false, identifier: '🤣', url: null, custom: false },
      { id: 'unicode_heart_eyes', name: 'heart_eyes', animated: false, identifier: '😍', url: null, custom: false },
      { id: 'unicode_thinking', name: 'thinking', animated: false, identifier: '🤔', url: null, custom: false },
      { id: 'unicode_eyes', name: 'eyes', animated: false, identifier: '👀', url: null, custom: false },
      { id: 'unicode_cry', name: 'cry', animated: false, identifier: '😢', url: null, custom: false },
      { id: 'unicode_sob', name: 'sob', animated: false, identifier: '😭', url: null, custom: false },
      { id: 'unicode_rage', name: 'rage', animated: false, identifier: '😡', url: null, custom: false },
      { id: 'unicode_scream', name: 'scream', animated: false, identifier: '😱', url: null, custom: false },
      { id: 'unicode_pleading', name: 'pleading', animated: false, identifier: '🥺', url: null, custom: false },

      // Status e validação
      { id: 'unicode_check', name: 'check', animated: false, identifier: '✅', url: null, custom: false },
      { id: 'unicode_x', name: 'x', animated: false, identifier: '❌', url: null, custom: false },
      { id: 'unicode_warning', name: 'warning', animated: false, identifier: '⚠️', url: null, custom: false },
      { id: 'unicode_question', name: 'question', animated: false, identifier: '❓', url: null, custom: false },
      { id: 'unicode_exclamation', name: 'exclamation', animated: false, identifier: '❗', url: null, custom: false },

      // Outros
      { id: 'unicode_100', name: '100', animated: false, identifier: '💯', url: null, custom: false },
      { id: 'unicode_muscle', name: 'muscle', animated: false, identifier: '💪', url: null, custom: false },
      { id: 'unicode_brain', name: 'brain', animated: false, identifier: '🧠', url: null, custom: false },
      { id: 'unicode_trophy', name: 'trophy', animated: false, identifier: '🏆', url: null, custom: false },
      { id: 'unicode_medal', name: 'medal', animated: false, identifier: '🏅', url: null, custom: false },
    ];

    // Combinar emojis Unicode primeiro, depois os custom do servidor
    const allEmojis = [...unicodeEmojis, ...customEmojisList];

    res.status(200).json({
      emojis: allEmojis,
      total: allEmojis.length
    });
  } catch (error) {
    console.error('Erro ao buscar emojis:', error);
    res.status(500).json({ error: 'Erro interno do servidor ao processar a lista de emojis.' });
  }
}