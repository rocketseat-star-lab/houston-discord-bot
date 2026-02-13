import { Client } from 'discord.js';
import { syncAllGuildMembers } from '../../services/memberSyncService';

export default {
  name: 'ready',
  once: true,
  async execute(client: Client<true>) {
    console.log(`✅ 🤖 Discord bot ready! Logged in as ${client.user.tag}`);
    console.log(`📊 Connected to ${client.guilds.cache.size} server(s)`);
    console.log('👂 Listening for messages...');

    // SYNC AUTOMÁTICO PERMANENTEMENTE DESABILITADO
    // Mesmo com paginação, Railway tem limite de memória muito baixo (~256MB)
    // Para sincronizar: POST /api/v1/discord-data/guilds/:guildId/sync-members
    console.log('ℹ️  Sync manual disponível via API endpoint');

    // setTimeout(async () => {
    //   try {
    //     await syncAllGuildMembers(client);
    //   } catch (error) {
    //     console.error('[ready] Erro ao sincronizar membros:', error);
    //   }
    // }, 5000);
  },
};