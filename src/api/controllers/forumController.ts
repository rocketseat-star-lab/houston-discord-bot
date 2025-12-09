import { Request, Response } from 'express';
import { Client, ChannelType, ForumChannel, ThreadChannel } from 'discord.js';

/**
 * Cria uma nova thread em um canal de forum.
 */
export async function createForumThread(req: Request, res: Response) {
  const discordClient = req.app.get('discordClient') as Client;
  const { channelId, threadName, messageContent, mentionUserId } = req.body;

  if (!discordClient || !discordClient.isReady()) {
    return res.status(503).json({ error: 'O cliente do Discord não está pronto ou disponível.' });
  }

  if (!channelId || !threadName || !messageContent) {
    return res.status(400).json({ error: 'channelId, threadName e messageContent são obrigatórios.' });
  }

  try {
    const channel = discordClient.channels.cache.get(channelId);

    if (!channel) {
      return res.status(404).json({ error: 'Canal não encontrado.' });
    }

    if (channel.type !== ChannelType.GuildForum) {
      return res.status(400).json({ error: 'O canal especificado não é um canal de forum.' });
    }

    const forumChannel = channel as ForumChannel;

    // Prepara o conteúdo da mensagem, opcionalmente mencionando o usuário
    let content = messageContent;
    if (mentionUserId) {
      content = `<@${mentionUserId}>\n\n${messageContent}`;
    }

    // Cria a thread no forum
    const thread = await forumChannel.threads.create({
      name: threadName,
      message: { content },
    });

    // Busca a mensagem inicial da thread
    const starterMessage = await thread.fetchStarterMessage();

    // Monta a URL da mensagem
    const guildId = forumChannel.guildId;
    const messageUrl = `https://discord.com/channels/${guildId}/${thread.id}/${starterMessage?.id}`;

    res.status(201).json({
      threadId: thread.id,
      messageId: starterMessage?.id,
      messageUrl,
    });
  } catch (error) {
    console.error('Erro ao criar thread no forum:', error);
    res.status(500).json({ error: 'Erro interno do servidor ao criar a thread.' });
  }
}

/**
 * Fecha/arquiva uma thread de forum.
 */
export async function closeForumThread(req: Request, res: Response) {
  const discordClient = req.app.get('discordClient') as Client;
  const { threadId } = req.params;
  const { closingMessage } = req.body;

  if (!discordClient || !discordClient.isReady()) {
    return res.status(503).json({ error: 'O cliente do Discord não está pronto ou disponível.' });
  }

  try {
    const thread = discordClient.channels.cache.get(threadId) as ThreadChannel;

    if (!thread) {
      // Tenta buscar o canal se não estiver no cache
      const fetchedChannel = await discordClient.channels.fetch(threadId);
      if (!fetchedChannel || !fetchedChannel.isThread()) {
        return res.status(404).json({ error: 'Thread não encontrada.' });
      }
    }

    const threadChannel = (thread || await discordClient.channels.fetch(threadId)) as ThreadChannel;

    if (!threadChannel.isThread()) {
      return res.status(400).json({ error: 'O canal especificado não é uma thread.' });
    }

    // Envia a mensagem de fechamento se fornecida
    if (closingMessage) {
      await threadChannel.send(closingMessage);
    }

    // Arquiva e tranca a thread
    await threadChannel.setArchived(true);
    await threadChannel.setLocked(true);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Erro ao fechar thread:', error);
    res.status(500).json({ error: 'Erro interno do servidor ao fechar a thread.' });
  }
}
