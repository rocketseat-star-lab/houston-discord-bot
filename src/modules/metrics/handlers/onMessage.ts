import { Message, MessageType } from 'discord.js';
import { METRICS_CONFIG } from '../config';
import { recordMessage } from '../services/messageService';

const TRACKED_MESSAGE_TYPES = [
  MessageType.Default,
  MessageType.Reply,
  MessageType.ChatInputCommand,
  MessageType.ContextMenuCommand,
];

export async function onMessage(message: Message): Promise<void> {
  if (!message.guild || !METRICS_CONFIG.allowedGuildIds.includes(message.guild.id)) return;
  if (message.author.bot || message.system) return;
  if (!TRACKED_MESSAGE_TYPES.includes(message.type)) return;

  try {
    await recordMessage({
      messageId: message.id,
      guildId: message.guild.id,
      userId: message.author.id,
      channelId: message.channel.id,
      channelName: 'name' in message.channel ? message.channel.name : null,
      categoryName: 'parent' in message.channel ? message.channel.parent?.name ?? null : null,
      contentLength: message.content?.length || 0,
      hasEmbed: message.embeds.length > 0,
      hasAttachment: message.attachments.size > 0,
      createdAt: message.createdAt,
    });
  } catch (error) {
    console.error(`[metrics] Error recording message ${message.id}:`, error);
  }
}
