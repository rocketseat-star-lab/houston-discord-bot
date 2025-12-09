import { Request, Response } from 'express';
import { Client, ChannelType, ForumChannel, ThreadChannel } from 'discord.js';

// Canal de fórum permitido para vagas
const ALLOWED_JOBS_CHANNEL_ID = '1181004381261398188';

/**
 * Lista os servidores onde o bot está presente.
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
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
}

/**
 * Lista os canais de fórum permitidos para vagas.
 * Retorna apenas o canal configurado se ele existir no servidor.
 */
export async function listJobChannels(req: Request, res: Response) {
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

    // Busca o canal permitido
    const channel = await guild.channels.fetch(ALLOWED_JOBS_CHANNEL_ID).catch(() => null);

    if (!channel || channel.type !== ChannelType.GuildForum) {
      return res.status(200).json({ channels: [] });
    }

    res.status(200).json({
      channels: [{
        id: channel.id,
        name: channel.name,
        type: channel.type,
      }]
    });
  } catch (error) {
    console.error('Erro ao buscar canais de vagas:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
}

/**
 * Cria uma nova thread de vaga em um canal de fórum.
 */
export async function createJobThread(req: Request, res: Response) {
  const discordClient = req.app.get('discordClient') as Client;
  const { channelId, threadName, messageContent, mentionUserId } = req.body;

  if (!discordClient || !discordClient.isReady()) {
    return res.status(503).json({ error: 'O cliente do Discord não está pronto ou disponível.' });
  }

  if (!channelId || !threadName || !messageContent) {
    return res.status(400).json({ error: 'channelId, threadName e messageContent são obrigatórios.' });
  }

  // Verifica se o canal é o permitido
  if (channelId !== ALLOWED_JOBS_CHANNEL_ID) {
    return res.status(403).json({ error: 'Canal não permitido para publicação de vagas.' });
  }

  try {
    const channel = discordClient.channels.cache.get(channelId);

    if (!channel || channel.type !== ChannelType.GuildForum) {
      return res.status(404).json({ error: 'Canal de fórum não encontrado.' });
    }

    const forumChannel = channel as ForumChannel;

    let content = messageContent;
    if (mentionUserId) {
      content = `<@${mentionUserId}>\n\n${messageContent}`;
    }

    const thread = await forumChannel.threads.create({
      name: threadName,
      message: { content },
    });

    const starterMessage = await thread.fetchStarterMessage();
    const guildId = forumChannel.guildId;
    const messageUrl = `https://discord.com/channels/${guildId}/${thread.id}/${starterMessage?.id}`;

    res.status(201).json({
      threadId: thread.id,
      messageId: starterMessage?.id,
      messageUrl,
    });
  } catch (error) {
    console.error('Erro ao criar thread de vaga:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
}

/**
 * Fecha/arquiva uma thread de vaga.
 */
export async function closeJobThread(req: Request, res: Response) {
  const discordClient = req.app.get('discordClient') as Client;
  const { threadId } = req.params;
  const { closingMessage } = req.body;

  if (!discordClient || !discordClient.isReady()) {
    return res.status(503).json({ error: 'O cliente do Discord não está pronto ou disponível.' });
  }

  try {
    let thread = discordClient.channels.cache.get(threadId) as ThreadChannel;

    if (!thread) {
      const fetchedChannel = await discordClient.channels.fetch(threadId).catch(() => null);
      if (!fetchedChannel || !fetchedChannel.isThread()) {
        return res.status(404).json({ error: 'Thread não encontrada.' });
      }
      thread = fetchedChannel as ThreadChannel;
    }

    if (!thread.isThread()) {
      return res.status(400).json({ error: 'O canal especificado não é uma thread.' });
    }

    if (closingMessage) {
      await thread.send(closingMessage);
    }

    await thread.setArchived(true);
    await thread.setLocked(true);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Erro ao fechar thread de vaga:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
}

/**
 * Envia uma DM para um usuário.
 */
export async function sendJobDm(req: Request, res: Response) {
  const discordClient = req.app.get('discordClient') as Client;
  const { userId, content } = req.body;

  if (!discordClient || !discordClient.isReady()) {
    return res.status(503).json({ error: 'O cliente do Discord não está pronto ou disponível.' });
  }

  if (!userId || !content) {
    return res.status(400).json({ error: 'userId e content são obrigatórios.' });
  }

  try {
    const user = await discordClient.users.fetch(userId);

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    try {
      const message = await user.send(content);
      res.status(200).json({ success: true, messageId: message.id });
    } catch (dmError: any) {
      console.warn(`Não foi possível enviar DM para ${userId}:`, dmError.message);
      return res.status(403).json({
        error: 'Não foi possível enviar a mensagem. O usuário pode ter DMs desabilitadas.'
      });
    }
  } catch (error) {
    console.error('Erro ao enviar DM:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
}
