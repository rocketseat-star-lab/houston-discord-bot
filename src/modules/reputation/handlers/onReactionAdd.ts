import { MessageReaction, PartialMessageReaction, User, PartialUser } from 'discord.js';
import { REPUTATION_CONFIG } from '../config';
import { toolsClient } from '../services/toolsClient';

export async function onReactionAdd(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser
): Promise<void> {
  try {
    if (user.bot) return;

    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch {
        return;
      }
    }
    if (reaction.message.partial) {
      try {
        await reaction.message.fetch();
      } catch {
        return;
      }
    }

    const guildId = reaction.message.guild?.id;
    if (!guildId || guildId !== REPUTATION_CONFIG.activeGuildId) return;

    const targetAuthorId = reaction.message.author?.id;
    if (!targetAuthorId) return;

    toolsClient.fireEvent({
      type: 'REACTION_GIVEN',
      payload: {
        guildId,
        discordUserId: user.id,
        targetMessageId: reaction.message.id,
        targetAuthorId,
      },
    });

    const reactorIds = new Set<string>();
    reaction.users.cache.forEach((u) => {
      if (!u.bot) reactorIds.add(u.id);
    });
    if (reactorIds.size >= REPUTATION_CONFIG.highReactionsThreshold) {
      toolsClient.fireEvent({
        type: 'HIGH_REACTIONS',
        payload: {
          guildId,
          discordUserId: targetAuthorId,
          messageId: reaction.message.id,
          uniqueReactors: reactorIds.size,
        },
      });
    }
  } catch (err) {
    console.error('[reputation] onReactionAdd error:', err);
  }
}
