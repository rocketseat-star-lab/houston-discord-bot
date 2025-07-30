import { Request, Response } from 'express';
import prisma from '../../services/prisma';
import { Client, TextChannel } from 'discord.js';
// Importe 'Prisma' junto com 'MessageStatus'
import { MessageStatus, Prisma } from '@prisma/client';

// Tipos para os corpos das requisições
interface ScheduleMessageBody {
  channelId: string;
  messageContent: string;
  scheduleTime: string;
}

interface UpdateScheduleBody {
    channelId?: string;
    messageContent?: string;
    scheduleTime?: string;
}

interface SendNowBody {
    channelId: string;
    messageContent: string;
}

// --- CRUD para Mensagens Agendadas ---

export async function createScheduledMessage(req: Request<{}, {}, ScheduleMessageBody>, res: Response) {
  const { channelId, messageContent, scheduleTime } = req.body;

  if (!channelId || !messageContent || !scheduleTime) {
    return res.status(400).json({ error: 'Dados ausentes. É necessário channelId, messageContent e scheduleTime.' });
  }

  const scheduleDate = new Date(scheduleTime);
  if (isNaN(scheduleDate.getTime()) || scheduleDate < new Date()) {
    return res.status(400).json({ error: 'Data de agendamento inválida ou no passado.' });
  }
  
  try {
    const result = await prisma.scheduledMessage.create({
        data: { channelId, messageContent, scheduleTime: scheduleDate }
    });
    res.status(201).json(result);
  } catch (error) {
    console.error('Erro ao criar agendamento:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor.' });
  }
}

export async function listScheduledMessages(req: Request, res: Response) {
  const statusQuery = req.query.status as string;
  const validStatuses: MessageStatus[] = ['PENDING', 'SENT', 'ERROR_SENDING', 'ERROR_CHANNEL_NOT_FOUND'];
  
  // AQUI ESTÁ A CORREÇÃO: Tipamos a variável com o tipo de filtro do Prisma.
  const whereClause: Prisma.ScheduledMessageWhereInput = {};

  if (statusQuery && validStatuses.includes(statusQuery as MessageStatus)) {
    whereClause.status = statusQuery as MessageStatus;
  }

  try {
    const messages = await prisma.scheduledMessage.findMany({
      where: whereClause,
      orderBy: {
        scheduleTime: 'desc'
      }
    });
    res.status(200).json(messages);
  } catch (error) {
    console.error('Erro ao listar agendamentos:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
}

export async function updateScheduledMessage(req: Request<{ id: string }, {}, UpdateScheduleBody>, res: Response) {
    const messageId = parseInt(req.params.id, 10);
    const { channelId, messageContent, scheduleTime } = req.body;

    if (isNaN(messageId)) {
        return res.status(400).json({ error: 'ID da mensagem inválido.' });
    }

    const dataToUpdate: UpdateScheduleBody = {};
    if (channelId) dataToUpdate.channelId = channelId;
    if (messageContent) dataToUpdate.messageContent = messageContent;
    if (scheduleTime) dataToUpdate.scheduleTime = scheduleTime;

    if (Object.keys(dataToUpdate).length === 0) {
        return res.status(400).json({ error: 'Nenhum dado fornecido para atualização.' });
    }

    try {
        const updatedMessage = await prisma.scheduledMessage.update({
            where: { id: messageId },
            data: dataToUpdate
        });
        res.status(200).json(updatedMessage);
    } catch (error) {
        // @ts-ignore
        if (error.code === 'P2025') { // Código de erro do Prisma para "Record not found"
            return res.status(404).json({ error: 'Mensagem agendada não encontrada.' });
        }
        console.error('Erro ao atualizar agendamento:', error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
}

export async function deleteScheduledMessage(req: Request<{ id: string }>, res: Response) {
    const messageId = parseInt(req.params.id, 10);

    if (isNaN(messageId)) {
        return res.status(400).json({ error: 'ID da mensagem inválido.' });
    }

    try {
        await prisma.scheduledMessage.delete({
            where: { id: messageId }
        });
        res.status(204).send(); // 204 No Content é a resposta padrão para delete bem-sucedido
    } catch (error) {
        // @ts-ignore
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Mensagem agendada não encontrada.' });
        }
        console.error('Erro ao deletar agendamento:', error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
}


// --- Ações Imediatas ---

export async function sendImmediateMessage(req: Request<{}, {}, SendNowBody>, res: Response) {
    const { channelId, messageContent } = req.body;
    const discordClient = req.app.get('discordClient') as Client;

    if (!channelId || !messageContent) {
        return res.status(400).json({ error: 'Dados ausentes. É necessário channelId e messageContent.' });
    }

    try {
        const channel = await discordClient.channels.fetch(channelId);
        if (channel instanceof TextChannel) {
            await channel.send(messageContent);
            res.status(200).json({ success: true, message: 'Mensagem enviada com sucesso.' });
        } else {
            res.status(404).json({ success: false, error: 'Canal não encontrado ou não é um canal de texto.' });
        }
    } catch (error) {
        console.error('Erro ao enviar mensagem imediata:', error);
        res.status(500).json({ success: false, error: 'Erro interno ao tentar enviar a mensagem.' });
    }
}