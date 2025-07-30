import { Request, Response } from 'express';
import prisma from '../../services/prisma';
import { Client, TextChannel } from 'discord.js';

interface ScheduleMessageBody {
  channelId: string;
  messageContent: string;
  scheduleTime: string;
}

interface SendNowBody {
    channelId: string;
    messageContent: string;
}

export async function scheduleMessage(req: Request<{}, {}, ScheduleMessageBody>, res: Response) {
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
        data: {
            channelId,
            messageContent,
            scheduleTime: scheduleDate,
        }
    });
    
    res.status(202).json({
      success: true,
      message: 'Mensagem agendada com sucesso.',
      data: result,
    });
  } catch (error) {
    console.error('Erro no controller scheduleMessage:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor.' });
  }
}

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