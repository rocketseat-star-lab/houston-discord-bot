import { Message } from 'discord.js';
import { REPUTATION_CONFIG } from '../config';
import { toolsClient } from '../services/toolsClient';

export async function onMessage(message: Message): Promise<void> {
  try {
    if (message.author.bot || message.system) return;
    if (!message.guild) return;
    if (message.guild.id !== REPUTATION_CONFIG.activeGuildId) return;

    const content = message.content?.trim() || '';
    if (content.length < 15) return;

    const isInSocialChannel = REPUTATION_CONFIG.socialChannelIds.includes(message.channel.id);

    toolsClient.fireEvent({
      type: 'MESSAGE',
      payload: {
        guildId: message.guild.id,
        discordUserId: message.author.id,
        username: message.author.username,
        globalName: message.author.globalName,
        avatarUrl: message.author.displayAvatarURL(),
        messageId: message.id,
        contentLength: content.length,
        contentSample: content.slice(0, 500),
        isInSocialChannel,
      },
    });
  } catch (err) {
    console.error('[reputation] onMessage error:', err);
  }
}
