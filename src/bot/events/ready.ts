import { Client } from 'discord.js';

export default {
  name: 'ready',
  once: true,
  execute(client: Client<true>) {
    console.log(`Bot do discord pronto! logado como ${client.user.tag}`);
  },
};