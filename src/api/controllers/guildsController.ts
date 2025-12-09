import { Request, Response } from 'express';
import { Client, ChannelType, PermissionFlagsBits } from 'discord.js';

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
 * Lista os canais de forum dentro da categoria "Oportunidades" de um servidor.
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

    // Faz fetch dos canais para garantir que o cache está atualizado
    const channels = await guild.channels.fetch();
    const botMember = guild.members.me;

    // Busca a categoria que contém "Oportunidades" no nome (case insensitive)
    const oportunidadesCategory = channels.find(
      channel => channel?.type === ChannelType.GuildCategory &&
        channel.name.toLowerCase().includes('oportunidades')
    );

    if (!oportunidadesCategory) {
      return res.status(200).json({ channels: [] });
    }

    // Busca todos os canais dentro dessa categoria
    const forumChannels: { id: string; name: string; type: number }[] = [];

    channels.forEach(channel => {
      if (!channel) return;
      if (channel.parentId !== oportunidadesCategory.id) return;

      // Verifica se o bot tem permissão de ver o canal
      if (botMember) {
        const permissions = channel.permissionsFor(botMember);
        if (!permissions?.has(PermissionFlagsBits.ViewChannel)) return;
      }

      forumChannels.push({
        id: channel.id,
        name: channel.name,
        type: channel.type,
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
    console.error('Erro ao buscar canais de forum:', error);
    res.status(500).json({ error: 'Erro interno do servidor ao processar a lista de canais.' });
  }
}