import { Events, MessageReaction, User } from 'discord.js';
import prisma from '../../services/prisma';

export default {
  name: Events.MessageReactionAdd,
  async execute(reaction: MessageReaction, user: User) {
    try {
      // Ignorar reações de bots
      if (user.bot) return;

      // Buscar informações parciais se necessário
      if (reaction.partial) {
        await reaction.fetch();
      }

      const message = reaction.message;
      if (!message.guild) return;

      const emoji = reaction.emoji;
      const isCustom = emoji.id !== null;
      const emojiIdentifier = isCustom ? emoji.id! : emoji.name!;

      await prisma.reactionLog.create({
        data: {
          messageId: message.id,
          guildId: message.guild.id,
          channelId: message.channel.id,
          userId: user.id,
          username: user.tag,
          emoji: emojiIdentifier,
          emojiName: emoji.name,
          isCustom,
        },
      });

      console.log(`[ReactionLog] ${user.tag} reagiu com ${emoji.name} em mensagem ${message.id.substring(0, 8)}...`);
    } catch (error) {
      console.error('[messageReactionAdd] Erro ao registrar reação:', error);
    }
  },
};
