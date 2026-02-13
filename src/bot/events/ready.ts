import { Client } from 'discord.js';
// import { syncAllGuildMembers } from '../../services/memberSyncService';

export default {
  name: 'ready',
  once: true,
  async execute(client: Client<true>) {
    console.log(`✅ 🤖 Discord bot ready! Logged in as ${client.user.tag}`);
    console.log(`📊 Connected to ${client.guilds.cache.size} server(s)`);
    console.log('👂 Listening for messages...');

    // SYNC AUTOMÁTICO DESABILITADO - Causa OOM em guilds grandes
    // Para sincronizar membros, use: POST /api/v1/discord-data/guilds/:guildId/sync-members
    console.log('⚠️  Sync automático de membros DESABILITADO');
    console.log('ℹ️  Use o endpoint manual para sincronizar: POST /sync-members');

    // setTimeout(async () => {
    //   try {
    //     await syncAllGuildMembers(client);
    //   } catch (error) {
    //     console.error('[ready] Erro ao sincronizar membros:', error);
    //   }
    // }, 5000);
  },
};