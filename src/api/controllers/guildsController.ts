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