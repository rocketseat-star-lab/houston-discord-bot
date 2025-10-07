import { Message, TextChannel } from 'discord.js';
import { getAiResponse } from '../../services/aiService';
import 'dotenv/config';

export default {
  name: 'messageCreate',
  async execute(message: Message) {
    // ---- Guard Clauses: Verificações iniciais para sair cedo ----

    // 1. Ignora mensagens se o canal não for de texto ou se não for em um servidor.
    // Esta é a correção principal: garantimos que o canal é de um tipo que
    // suporta 'sendTyping' antes de prosseguir.
    if (!(message.channel instanceof TextChannel) || !message.guild) return;

    // 2. Ignora mensagens de outros bots para evitar loops.
    if (message.author.bot) return;

    // 3. Verifica se o bot foi mencionado e se está no servidor configurado.
    const wasMentioned = message.mentions.has(message.client.user.id);
    const isConfiguredGuild = message.guild.id === process.env.AI_AGENT_GUILD_ID;
    if (!wasMentioned || !isConfiguredGuild) return;

    // ---- Lógica Principal ----

    console.log(`💬 New message from ${message.author.tag} in #${message.channel.name}`);

    // Remove a menção do bot da mensagem para obter o texto limpo
    const userMessage = message.content.replace(/<@!?\d+>/, '').trim();
    if (!userMessage) {
      console.log('📭 Empty message received, sending active status');
      await message.reply('Estou ativo e operante!');
      return;
    }

    console.log(`📨 Processing message: "${userMessage.substring(0, 50)}${userMessage.length > 50 ? '...' : ''}"`);

    try {
      // Agora é 100% seguro chamar sendTyping, pois já validamos o tipo do canal.
      await message.channel.sendTyping();
      console.log('🤔 Fetching AI response...');
      const aiReply = await getAiResponse(userMessage);

      if (aiReply) {
        console.log('✅ AI response received, sending reply');
        await message.reply(aiReply);
      } else {
        console.log('⚠️  No AI response received');
        await message.reply('Não consegui processar sua solicitação no momento. Tente novamente mais tarde.');
      }
    } catch (error) {
      console.error('❌ Error processing AI response in messageCreate event:', error);
    }
  },
};