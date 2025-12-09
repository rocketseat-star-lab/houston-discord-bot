import { Request, Response } from 'express';
import { Client, ChannelType, PermissionFlagsBits, ForumChannel } from 'discord.js';

/**
 * Lista todos os servidores (guilds) em que o bot está.
 */
export async function listGuilds(req: Request, res: Response) {
  const discordClient = req.app.get('discordClient') as Client;

  if (!discordClient || !discordClient.isReady()) {
    return res.status(503).json({ error: 'O cliente do Discord não está pronto ou disponível.' });
  }

  try {
    const guilds = discordClient.guilds.cache.map(guild => ({
      id: guild.id,
      name: guild.name,
      iconURL: guild.iconURL(),
    }));

    res.status(200).json(guilds);
  } catch (error) {
    console.error('Erro ao buscar servidores:', error);
    res.status(500).json({ error: 'Erro interno do servidor ao processar a lista de servidores.' });
  }
}

/**
 * Lista os canais de forum de um servidor específico.
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

    const botMember = guild.members.me;

    const forumChannels = guild.channels.cache
      .filter((channel): channel is ForumChannel => {
        if (channel.type !== ChannelType.GuildForum) return false;

        // Verifica se o bot tem permissão de enviar mensagens no canal
        if (botMember) {
          const permissions = channel.permissionsFor(botMember);
          if (!permissions?.has(PermissionFlagsBits.SendMessages)) return false;
        }

        return true;
      })
      .sort((a, b) => a.position - b.position)
      .map(channel => ({
        id: channel.id,
        name: channel.name,
      }));

    res.status(200).json({ channels: forumChannels });
  } catch (error) {
    console.error('Erro ao buscar canais de forum:', error);
    res.status(500).json({ error: 'Erro interno do servidor ao processar a lista de canais.' });
  }
}