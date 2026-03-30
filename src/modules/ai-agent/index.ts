import { Message, TextChannel, NewsChannel } from 'discord.js';
import { getAiResponse } from '../../services/aiService';
import type { FeatureModule } from '../../core/module';

async function onMessage(message: Message): Promise<void> {
  if (!(message.channel instanceof TextChannel || message.channel instanceof NewsChannel) || !message.guild) return;
  if (message.author.bot || message.system) return;

  const wasMentioned = message.mentions.has(message.client.user!.id);
  const isConfiguredGuild = message.guild.id === process.env.AI_AGENT_GUILD_ID;
  if (!wasMentioned || !isConfiguredGuild) return;

  console.log(`💬 New message from ${message.author.tag} in #${message.channel.name}`);

  const userMessage = message.content.replace(/<@!?\d+>/, '').trim();
  if (!userMessage) {
    await message.reply('Estou ativo e operante!');
    return;
  }

  console.log(`📨 Processing message: "${userMessage.substring(0, 50)}${userMessage.length > 50 ? '...' : ''}"`);

  try {
    await message.channel.sendTyping();
    const aiReply = await getAiResponse(userMessage);

    if (aiReply) {
      await message.reply(aiReply);
    } else {
      await message.reply('Não consegui processar sua solicitação no momento. Tente novamente mais tarde.');
    }
  } catch (error) {
    console.error('❌ Error processing AI response:', error);
  }
}

export const aiAgentModule: FeatureModule = {
  name: 'ai-agent',
  description: 'AI responses to mentions using external AI service',
  handlers: {
    messageCreate: onMessage,
  },
};
