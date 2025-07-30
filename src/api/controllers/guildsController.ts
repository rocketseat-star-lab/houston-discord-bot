import { Request, Response } from 'express';
import { Client, ChannelType } from 'discord.js';

/**
 * Lista todos os servidores (guilds) em que o bot está,
 * junto com seus respectivos canais de texto.
 */
export async function listGuilds(req: Request, res: Response) {
  const discordClient = req.app.get('discordClient') as Client;

  if (!discordClient || !discordClient.isReady()) {
    return res.status(503).json({ error: 'O cliente do Discord não está pronto ou disponível.' });
  }

  try {
    // Busca os servidores do cache do bot
    const guilds = discordClient.guilds.cache.map(guild => {
      
      // Para cada servidor, busca os canais
      const channels = guild.channels.cache
        // Filtra para pegar apenas canais de texto e de anúncios
        .filter(channel => 
          channel.type === ChannelType.GuildText || 
          channel.type === ChannelType.GuildAnnouncement
        )
        // Ordena os canais pela sua posição no servidor
        .sort((a, b) => a.position - b.position)
        // Mapeia para o formato que o front-end precisa
        .map(channel => {
          return {
            id: channel.id,
            name: channel.name,
          };
        });

      // Retorna o objeto formatado para cada servidor
      return {
        id: guild.id,
        name: guild.name,
        iconURL: guild.iconURL(), // Retorna a URL do ícone do servidor
        channels: channels,
      };
    });

    res.status(200).json(guilds);

  } catch (error) {
    console.error('Erro ao buscar servidores e canais:', error);
    res.status(500).json({ error: 'Erro interno do servidor ao processar a lista de servidores.' });
  }
}