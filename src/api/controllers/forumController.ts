import { Request, Response } from 'express';
import { Client, ChannelType, ForumChannel, ThreadChannel } from 'discord.js';

/**
 * Cria uma nova thread em um canal de fórum.
 */
export async function createForumThread(req: Request, res: Response) {
  const discordClient = req.app.get('discordClient') as Client;
  const { channelId, threadName, messageContent, mentionUserId } = req.body;

  console.log(`[createForumThread] Recebida requisição para criar thread: ${threadName} no canal: ${channelId}`);

  if (!discordClient || !discordClient.isReady()) {
    console.error('[createForumThread] Discord client não está pronto');
    return res.status(503).json({ error: 'Discord client not ready', code: 'CLIENT_NOT_READY' });
  }

  if (!channelId || !threadName || !messageContent) {
    return res.status(400).json({ error: 'channelId, threadName e messageContent são obrigatórios', code: 'MISSING_FIELDS' });
  }

  try {
    // Busca o canal de fórum
    let channel = discordClient.channels.cache.get(channelId);

    if (!channel) {
      console.log(`[createForumThread] Canal não encontrado no cache, buscando: ${channelId}`);
      channel = await discordClient.channels.fetch(channelId).catch(() => null) ?? undefined;
    }

    if (!channel) {
      console.error(`[createForumThread] Canal não encontrado: ${channelId}`);
      return res.status(404).json({ error: 'Channel not found', code: 'CHANNEL_NOT_FOUND' });
    }

    if (channel.type !== ChannelType.GuildForum) {
      console.error(`[createForumThread] Canal não é um fórum: ${channelId}`);
      return res.status(400).json({ error: 'Channel is not a forum', code: 'NOT_A_FORUM' });
    }

    const forumChannel = channel as ForumChannel;

    // Prepara o conteúdo da mensagem, opcionalmente mencionando o usuário
    let content = messageContent;
    if (mentionUserId) {
      content = `<@${mentionUserId}>\n\n${messageContent}`;
    }

    // Cria a thread no forum
    console.log(`[createForumThread] Criando thread: ${threadName}`);
    const thread = await forumChannel.threads.create({
      name: threadName,
      message: { content },
    });

    // Busca a mensagem inicial da thread
    const starterMessage = await thread.fetchStarterMessage();

    // Suprime os embeds de links na mensagem
    if (starterMessage) {
      console.log(`[createForumThread] Suprimindo embeds da mensagem`);
      await starterMessage.suppressEmbeds(true);
    }

    // Monta a URL da mensagem
    const messageUrl = `https://discord.com/channels/${forumChannel.guildId}/${thread.id}/${starterMessage?.id}`;

    console.log(`[createForumThread] Thread criada com sucesso: ${thread.id}`);
    res.status(201).json({
      success: true,
      threadId: thread.id,
      messageId: starterMessage?.id,
      messageUrl,
    });
  } catch (error) {
    console.error('[createForumThread] Erro ao criar thread:', error);
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

/**
 * Fecha/arquiva uma thread de forum (vaga de emprego).
 * - Envia mensagem de fechamento
 * - Renomeia a thread com prefixo "[FECHADA]"
 * - Arquiva e tranca a thread
 */
export async function closeForumThread(req: Request, res: Response) {
  const discordClient = req.app.get('discordClient') as Client;
  const { threadId } = req.params;
  const { title, closingMessage } = req.body;

  console.log(`[closeForumThread] Recebida requisição para fechar thread: ${threadId}`);

  if (!discordClient || !discordClient.isReady()) {
    console.error('[closeForumThread] Discord client não está pronto');
    return res.status(503).json({ error: 'Discord client not ready', code: 'CLIENT_NOT_READY' });
  }

  try {
    let threadChannel = discordClient.channels.cache.get(threadId) as ThreadChannel;

    if (!threadChannel) {
      console.log(`[closeForumThread] Thread não encontrada no cache, buscando: ${threadId}`);
      const fetchedChannel = await discordClient.channels.fetch(threadId).catch(() => null);
      if (!fetchedChannel || !fetchedChannel.isThread()) {
        console.error(`[closeForumThread] Thread não encontrada: ${threadId}`);
        return res.status(404).json({ error: 'Thread not found', code: 'THREAD_NOT_FOUND' });
      }
      threadChannel = fetchedChannel as ThreadChannel;
    }

    if (!threadChannel.isThread()) {
      console.error(`[closeForumThread] Canal não é uma thread: ${threadId}`);
      return res.status(400).json({ error: 'Channel is not a thread', code: 'NOT_A_THREAD' });
    }

    console.log(`[closeForumThread] Thread encontrada: ${threadChannel.name}`);

    // Envia a mensagem de fechamento se fornecida
    if (closingMessage) {
      console.log(`[closeForumThread] Enviando mensagem de fechamento`);
      const sentMessage = await threadChannel.send(closingMessage);
      // Suprime os embeds de links na mensagem
      await sentMessage.suppressEmbeds(true);
    }

    // Renomeia a thread com prefixo "[FECHADA]"
    const newTitle = title ? `[FECHADA] ${title}` : `[FECHADA] ${threadChannel.name}`;
    console.log(`[closeForumThread] Renomeando thread para: ${newTitle}`);
    await threadChannel.setName(newTitle);

    // Arquiva e tranca a thread
    console.log(`[closeForumThread] Arquivando e trancando thread`);
    await threadChannel.setArchived(true);
    await threadChannel.setLocked(true);

    console.log(`[closeForumThread] Thread fechada com sucesso: ${threadId}`);
    res.status(200).json({
      success: true,
      threadId: threadChannel.id,
    });
  } catch (error) {
    console.error('[closeForumThread] Erro ao fechar thread:', error);
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}
