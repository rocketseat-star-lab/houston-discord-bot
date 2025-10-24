import { Request, Response } from 'express';
import prisma from '../../services/prisma';
import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { MessageStatus, Prisma } from '@prisma/client';

// Interfaces atualizadas
interface ScheduleMessageBody {
  channelId: string;
  messageContent: string;
  scheduleTime: string;
  title?: string;
  imageUrl?: string;
}

interface UpdateScheduleBody {
    channelId?: string;
    messageContent?: string;
    scheduleTime?: string;
    title?: string;
    imageUrl?: string;
}

interface SendNowBody {
    channelId: string;
    messageContent: string;
    title?: string;
    imageUrl?: string;
}

interface EditSentMessageBody {
    messageContent?: string;
    title?: string;
    imageUrl?: string;
}

// --- CRUD para Mensagens Agendadas ---

export async function createScheduledMessage(req: Request<{}, {}, ScheduleMessageBody>, res: Response) {
  const { channelId, messageContent, scheduleTime, title, imageUrl } = req.body;
  const discordClient = req.app.get('discordClient') as Client;

  if (!channelId || !messageContent || !scheduleTime) {
    return res.status(400).json({ error: 'Dados ausentes.' });
  }
  if (title && title.length > 30) {
    return res.status(400).json({ error: 'O título não pode exceder 30 caracteres.' });
  }

  const scheduleDate = new Date(scheduleTime);
  if (isNaN(scheduleDate.getTime()) || scheduleDate < new Date()) {
    return res.status(400).json({ error: 'Data de agendamento inválida.' });
  }

  try {
    const channel = await discordClient.channels.fetch(channelId);
    if (!channel || !('guildId' in channel)) {
        return res.status(404).json({ error: 'Canal não encontrado ou inválido.' });
    }
    const guildId = channel.guildId;

    const result = await prisma.scheduledMessage.create({
        data: { guildId, channelId, messageContent, scheduleTime: scheduleDate, title, imageUrl }
    });
    res.status(201).json(result);
  } catch (error) {
    console.error('Erro ao criar agendamento:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor.' });
  }
}

export async function listScheduledMessages(req: Request, res: Response) {
  const discordClient = req.app.get('discordClient') as Client;
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 20;
  const skip = (page - 1) * limit;
  const { status, guildId, startDate, endDate } = req.query;
  const whereClause: Prisma.ScheduledMessageWhereInput = {};

  if (status && ['PENDING', 'SENT', 'ERROR_SENDING', 'ERROR_CHANNEL_NOT_FOUND'].includes(status as string)) {
    whereClause.status = status as MessageStatus;
  }
  if (guildId) whereClause.guildId = guildId as string;
  if (startDate || endDate) {
    whereClause.scheduleTime = {};
    if (startDate) whereClause.scheduleTime.gte = new Date(startDate as string);
    if (endDate) whereClause.scheduleTime.lte = new Date(endDate as string);
  }

  try {
    const [messages, total] = await prisma.$transaction([
      prisma.scheduledMessage.findMany({ where: whereClause, orderBy: { scheduleTime: 'desc' }, skip, take: limit }),
      prisma.scheduledMessage.count({ where: whereClause })
    ]);

    const enrichedMessages = messages.map(msg => ({
      ...msg,
      guildName: discordClient.guilds.cache.get(msg.guildId)?.name || 'Servidor Desconhecido'
    }));

    res.status(200).json({ messages: enrichedMessages, total });
  } catch (error) {
    console.error('Erro ao listar agendamentos:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
}

export async function updateScheduledMessage(req: Request<{ id: string }, {}, UpdateScheduleBody>, res: Response) {
    const messageId = parseInt(req.params.id, 10);
    if (isNaN(messageId)) return res.status(400).json({ error: 'ID da mensagem inválido.' });

    const { channelId, messageContent, scheduleTime, title, imageUrl } = req.body;

    // --- LÓGICA ATUALIZADA AQUI ---
    const dataToUpdate: Prisma.ScheduledMessageUpdateInput = {};

    if (title !== undefined) {
        if (title.length > 30) return res.status(400).json({ error: 'O título não pode exceder 30 caracteres.' });
        dataToUpdate.title = title;
    }
    if (channelId) dataToUpdate.channelId = channelId;
    if (messageContent) dataToUpdate.messageContent = messageContent;
    if (imageUrl !== undefined) dataToUpdate.imageUrl = imageUrl;
    if (scheduleTime) {
        const newScheduleDate = new Date(scheduleTime);
        if (isNaN(newScheduleDate.getTime()) || newScheduleDate < new Date()) {
            return res.status(400).json({ error: 'A nova data de agendamento é inválida ou está no passado.' });
        }
        dataToUpdate.scheduleTime = newScheduleDate;
    }
    // --- FIM DA ATUALIZAÇÃO ---

    if (Object.keys(dataToUpdate).length === 0) {
        return res.status(400).json({ error: 'Nenhum dado fornecido para atualização.' });
    }

    try {
        const updatedMessage = await prisma.scheduledMessage.update({
            where: { id: messageId, status: 'PENDING' }, // Garante que só podemos editar mensagens pendentes
            data: dataToUpdate
        });
        res.status(200).json(updatedMessage);
    } catch (error) {
        // @ts-ignore
        if (error.code === 'P2025') return res.status(404).json({ error: 'Mensagem pendente não encontrada para edição.' });
        console.error('Erro ao atualizar agendamento:', error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
}

export async function deleteScheduledMessage(req: Request<{ id: string }>, res: Response) {
    const messageId = parseInt(req.params.id, 10);
    if (isNaN(messageId)) return res.status(400).json({ error: 'ID da mensagem inválido.' });

    try {
        await prisma.scheduledMessage.delete({ where: { id: messageId }});
        res.status(204).send();
    } catch (error) {
        // @ts-ignore
        if (error.code === 'P2025') return res.status(404).json({ error: 'Mensagem agendada não encontrada.' });
        console.error('Erro ao deletar agendamento:', error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
}


// --- Ações Imediatas e Pós-Envio ---

export async function sendImmediateMessage(req: Request<{}, {}, SendNowBody>, res: Response) {
    const { channelId, messageContent, title, imageUrl } = req.body;
    const discordClient = req.app.get('discordClient') as Client;

    if (!channelId || !messageContent) return res.status(400).json({ error: 'Dados ausentes.' });
    if (title && title.length > 30) return res.status(400).json({ error: 'O título não pode exceder 30 caracteres.' });

    try {
        const channel = await discordClient.channels.fetch(channelId);
        if (!(channel instanceof TextChannel)) return res.status(404).json({ error: 'Canal não encontrado ou não é um canal de texto.' });

        // Preparar opções de envio
        const options: any = { content: messageContent };

        // Adicionar embed com imagem se imageUrl for fornecida
        if (imageUrl) {
            const embed = new EmbedBuilder().setImage(imageUrl);
            options.embeds = [embed];
        }

        const sentMessage = await channel.send(options);
        const guildId = channel.guildId;

        const dbRecord = await prisma.scheduledMessage.create({
            data: {
                guildId,
                channelId,
                messageContent,
                title,
                imageUrl,
                scheduleTime: new Date(),
                status: 'SENT',
                messageUrl: sentMessage.url
            }
        });

        res.status(201).json(dbRecord);
    } catch (error) {
        console.error('Erro ao enviar mensagem imediata:', error);
        res.status(500).json({ error: 'Erro interno ao tentar enviar a mensagem.' });
    }
}

export async function editSentMessage(req: Request<{ id: string }, {}, EditSentMessageBody>, res: Response) {
    const messageId = parseInt(req.params.id, 10);
    if (isNaN(messageId)) return res.status(400).json({ error: 'ID da mensagem inválido.' });

    const { messageContent, title, imageUrl } = req.body;
    const discordClient = req.app.get('discordClient') as Client;

    // --- LÓGICA ATUALIZADA AQUI ---
    const dataToUpdate: Prisma.ScheduledMessageUpdateInput = {};
    if (title !== undefined) {
        if (title.length > 30) return res.status(400).json({ error: 'O título não pode exceder 30 caracteres.' });
        dataToUpdate.title = title;
    }
    if (messageContent) dataToUpdate.messageContent = messageContent;
    if (imageUrl !== undefined) dataToUpdate.imageUrl = imageUrl;

    if (Object.keys(dataToUpdate).length === 0) {
        return res.status(400).json({ error: 'Nenhum dado fornecido para atualização (title, messageContent ou imageUrl).' });
    }
    // --- FIM DA ATUALIZAÇÃO ---

    try {
        const record = await prisma.scheduledMessage.findUnique({ where: { id: messageId } });
        if (!record) return res.status(404).json({ error: 'Registro da mensagem não encontrado.' });
        if (record.status === 'PENDING') return res.status(400).json({ error: 'Esta mensagem ainda está pendente. Use o endpoint de agendamento para editá-la.' });

        // Se houver novo conteúdo ou imagem, edita a mensagem no Discord
        if ((messageContent || imageUrl !== undefined) && record.messageUrl) {
            const channel = await discordClient.channels.fetch(record.channelId);
            if (!(channel instanceof TextChannel)) return res.status(404).json({ error: 'Canal da mensagem não encontrado.' });
            const discordMessage = await channel.messages.fetch(record.messageUrl.split('/').pop()!);

            // Preparar opções de edição
            const editOptions: any = { content: messageContent || record.messageContent };

            // Adicionar ou atualizar embed com imagem
            if (imageUrl !== undefined) {
                if (imageUrl) {
                    const embed = new EmbedBuilder().setImage(imageUrl);
                    editOptions.embeds = [embed];
                } else {
                    // Remove embed se imageUrl for null/empty
                    editOptions.embeds = [];
                }
            }

            await discordMessage.edit(editOptions);
        }

        const updatedRecord = await prisma.scheduledMessage.update({ where: { id: messageId }, data: dataToUpdate});
        res.status(200).json(updatedRecord);

    } catch (error) {
        console.error('Erro ao editar mensagem enviada:', error);
        res.status(500).json({ error: 'Erro ao editar mensagem no Discord.' });
    }
}

export async function deleteSentMessage(req: Request<{ id: string }>, res: Response) {
    const messageId = parseInt(req.params.id, 10);
    const discordClient = req.app.get('discordClient') as Client;
    if (isNaN(messageId)) return res.status(400).json({ error: 'ID da mensagem inválido.' });

    try {
        const record = await prisma.scheduledMessage.findUnique({ where: { id: messageId } });
        if (!record) return res.status(404).json({ error: 'Registro da mensagem não encontrado.' });

        if (record.messageUrl) {
            try {
                const channel = await discordClient.channels.fetch(record.channelId);
                if (channel instanceof TextChannel) {
                    await channel.messages.delete(record.messageUrl.split('/').pop()!);
                }
            } catch (discordError) {
                console.warn(`Não foi possível deletar a mensagem do Discord (ID: ${record.id}), talvez já tenha sido removida. Prosseguindo com a deleção do registro.`)
            }
        }
        
        await prisma.scheduledMessage.delete({ where: { id: messageId } });
        res.status(204).send();

    } catch (error) {
        console.error('Erro ao deletar mensagem enviada:', error);
        res.status(500).json({ error: 'Erro ao deletar mensagem.' });
    }
}