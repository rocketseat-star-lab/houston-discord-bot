import { Client } from 'discord.js';

export default {
  name: 'ready',
  once: true,
  execute(client: Client<true>) {
    console.log(`✅ 🤖 Discord bot ready! Logged in as ${client.user.tag}`);
    console.log(`📊 Connected to ${client.guilds.cache.size} server(s)`);
    console.log('👂 Listening for messages...');
  },
};