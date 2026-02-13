import { Client } from 'discord.js';
import { syncAllGuildMembers } from '../../services/memberSyncService';

export default {
  name: 'ready',
  once: true,
  async execute(client: Client<true>) {
    console.log(`✅ 🤖 Discord bot ready! Logged in as ${client.user.tag}`);
    console.log(`📊 Connected to ${client.guilds.cache.size} server(s)`);
    console.log('👂 Listening for messages...');

    // Sincronizar cache de membros em background
    setTimeout(async () => {
      try {
        await syncAllGuildMembers(client);
      } catch (error) {
        console.error('[ready] Erro ao sincronizar membros:', error);
      }
    }, 5000);
  },
};