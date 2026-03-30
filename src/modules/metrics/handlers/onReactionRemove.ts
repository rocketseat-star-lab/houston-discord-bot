import { MessageReaction, User, PartialMessageReaction, PartialUser } from 'discord.js';
import { METRICS_CONFIG } from '../config';
import { recordReaction } from '../services/reactionService';

export async function onReactionRemove(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser
): Promise<void> {
  try {
    if (reaction.partial) {
      try { reaction = await reaction.fetch(); } catch { return; }
    }
    if (user.partial) {
      try { user = await user.fetch(); } catch { return; }
    }

    const guildId = reaction.message.guild?.id;
    if (!guildId || !METRICS_CONFIG.allowedGuildIds.includes(guildId)) return;

    const emoji = reaction.emoji.id || reaction.emoji.name || 'unknown';

    await recordReaction({
      messageId: reaction.message.id,
      guildId,
      userId: user.id,
      channelId: reaction.message.channel.id,
      emoji,
      eventType: 'removed',
    });
  } catch (error) {
    console.error(`[metrics] Error recording reaction remove:`, error);
  }
}
