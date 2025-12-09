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
 * Lista os canais de forum de um servidor.
 * Prioriza canais dentro da categoria "Oportunidades", mas retorna todos os fóruns se não encontrar.
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

    // Log para debug
    console.log(`[listForumChannels] Guild: ${guild.name}, Total channels: ${channels.size}`);

    // Lista todos os canais com seus tipos para debug
    const channelTypes: { [key: number]: number } = {};
    channels.forEach(channel => {
      if (channel) {
        channelTypes[channel.type] = (channelTypes[channel.type] || 0) + 1;
      }
    });
    console.log(`[listForumChannels] Channel types count:`, channelTypes);
    console.log(`[listForumChannels] GuildForum type value: ${ChannelType.GuildForum}`);

    // Busca a categoria que contém "Oportunidades" no nome (case insensitive)
    const oportunidadesCategory = channels.find(
      channel => channel?.type === ChannelType.GuildCategory &&
        channel.name.toLowerCase().includes('oportunidades')
    );

    console.log(`[listForumChannels] Oportunidades category found: ${oportunidadesCategory?.name || 'NOT FOUND'}`);

    // Busca todos os canais de fórum
    const forumChannels: { id: string; name: string; type: number }[] = [];

    channels.forEach(channel => {
      if (!channel) return;

      // Se encontrou categoria Oportunidades, filtra por ela
      // Senão, retorna todos os canais de fórum
      if (oportunidadesCategory) {
        if (channel.parentId !== oportunidadesCategory.id) return;
      } else {
        // Sem categoria, retorna apenas canais de fórum (type 15)
        if (channel.type !== ChannelType.GuildForum) return;
      }

      // Verifica se o bot tem permissão de ver o canal
      if (botMember) {
        const permissions = channel.permissionsFor(botMember);
        if (!permissions?.has(PermissionFlagsBits.ViewChannel)) {
          console.log(`[listForumChannels] No ViewChannel permission for: ${channel.name}`);
          return;
        }
      }

      console.log(`[listForumChannels] Adding channel: ${channel.name} (type: ${channel.type})`);
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

    console.log(`[listForumChannels] Returning ${forumChannels.length} channels`);
    res.status(200).json({ channels: forumChannels });
  } catch (error) {
    console.error('Erro ao buscar canais de forum:', error);
    res.status(500).json({ error: 'Erro interno do servidor ao processar a lista de canais.' });
  }
}