import cron from 'node-cron';
import prisma from '../../services/prisma';
import { Client, TextChannel, NewsChannel, AttachmentBuilder } from 'discord.js';
import { MessageStatus } from '@prisma/client';
import type { FeatureModule } from '../../core/module';

// Import existing API routes
import messageRoutes from '../../api/routes/messages.routes';

let discordClient: Client;

async function processScheduledMessages(): Promise<void> {
  const messagesToSend = await prisma.scheduledMessage.findMany({
    where: {
      status: 'PENDING',
      scheduleTime: { lte: new Date() },
    },
  });

  if (messagesToSend.length === 0) return;

  console.log(`[scheduler] Found ${messagesToSend.length} messages to send`);

  for (const msg of messagesToSend) {
    let status: MessageStatus = 'SENT';
    let messageUrl: string | null = null;

    try {
      const channel = await discordClient.channels.fetch(msg.channelId);

      if (channel instanceof TextChannel || channel instanceof NewsChannel) {
        const options: any = {
          content: msg.messageContent,
          allowedMentions: { parse: ['everyone', 'roles', 'users'] },
        };

        if (msg.imageUrl) {
          const attachment = new AttachmentBuilder(msg.imageUrl);
          options.files = [attachment];
        }

        const sentMessage = await channel.send(options);
        messageUrl = sentMessage.url;

        if (msg.reactions && msg.reactions.length > 0) {
          for (const reaction of msg.reactions) {
            try {
              await sentMessage.react(reaction);
            } catch (error) {
              console.error(`[scheduler] Error adding reaction ${reaction}:`, error);
            }
          }
        }

        console.log(`[scheduler] Message ${msg.id} sent to channel ${msg.channelId}`);
      } else {
        status = 'ERROR_CHANNEL_NOT_FOUND';
        console.error(`[scheduler] Channel ${msg.channelId} not found for message ${msg.id}`);
      }
    } catch (error) {
      status = 'ERROR_SENDING';
      console.error(`[scheduler] Error sending message ${msg.id}:`, error);
    } finally {
      await prisma.scheduledMessage.update({
        where: { id: msg.id },
        data: { status, messageUrl },
      });
    }
  }
}

export const schedulerModule: FeatureModule = {
  name: 'messages',
  description: 'Scheduled message delivery system',
  routes: messageRoutes,
  schedulers: [
    {
      name: 'process-scheduled-messages',
      cron: '* * * * *',
      handler: processScheduledMessages,
    },
  ],
  async initialize(client) {
    discordClient = client;
    console.log('[scheduler] Message scheduler initialized');
  },
};
