import cron from 'node-cron';
import prisma from '../services/prisma';
import { Client, TextChannel, AttachmentBuilder } from 'discord.js';
import { MessageStatus } from '@prisma/client';

export function initializeScheduler(discordClient: Client) {
  // Alterado para rodar a cada minuto.
  cron.schedule('* * * * *', async () => {
    console.log('Verificando por mensagens agendadas...');

    const messagesToSend = await prisma.scheduledMessage.findMany({
      where: {
        status: 'PENDING',
        scheduleTime: {
          lte: new Date(),
        },
      },
    });

    if (messagesToSend.length === 0) {
      return;
    }
    console.log(`Encontradas ${messagesToSend.length} mensagens para enviar.`);

    for (const msg of messagesToSend) {
      let status: MessageStatus = 'SENT';
      let messageUrl: string | null = null;

      try {
        const channel = await discordClient.channels.fetch(msg.channelId);

        if (channel instanceof TextChannel) {
          // Preparar opções de envio
          const options: any = {
            content: msg.messageContent,
            allowedMentions: {
              parse: ['everyone', 'roles', 'users'],
            }
          };

          // Adicionar imagem como attachment se imageUrl estiver presente
          if (msg.imageUrl) {
            const attachment = new AttachmentBuilder(msg.imageUrl);
            options.files = [attachment];
          }

          const sentMessage = await channel.send(options);
          messageUrl = sentMessage.url;

          // Adicionar reações se fornecidas
          if (msg.reactions && msg.reactions.length > 0) {
            for (const reaction of msg.reactions) {
              try {
                await sentMessage.react(reaction);
              } catch (error) {
                console.error(`Erro ao adicionar reação ${reaction} na mensagem ${msg.id}:`, error);
              }
            }
          }

          console.log(`Mensagem ${msg.id} enviada para o canal ${msg.channelId}.`);
        } else {
          status = 'ERROR_CHANNEL_NOT_FOUND';
          console.error(`Canal ${msg.channelId} não encontrado ou inválido para a mensagem ${msg.id}.`);
        }
      } catch (error) {
        status = 'ERROR_SENDING';
        console.error(`Erro ao enviar a mensagem agendada ${msg.id}:`, error);
      } finally {
        await prisma.scheduledMessage.update({
          where: { id: msg.id },
          data: { status, messageUrl },
        });
      }
    }
  });

  console.log('Agendador de mensagens inicializado. Verificando a cada minuto.');
}