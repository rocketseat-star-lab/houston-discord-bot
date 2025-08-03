// --- CORREÇÃO GLOBAL PARA SERIALIZAÇÃO DE BIGINT ---
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors'; // <-- 1. IMPORTE O PACOTE
import { Client, GatewayIntentBits, Collection } from 'discord.js';
import 'dotenv/config';

import { apiKeyAuth } from './api/middlewares/apiKeyAuth';
import messageRoutes from './api/routes/messages.routes';
import guildsRoutes from './api/routes/guilds.routes';
import { initializeScheduler } from './scheduler/messageScheduler';

// --- INICIALIZAÇÃO DO CLIENTE DISCORD ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Carregando os eventos do bot
const eventsPath = path.join(__dirname, 'bot', 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath).default;
  if (event.once) {
    client.once(event.name, (...args: any[]) => event.execute(...args));
  } else {
    client.on(event.name, (...args: any[]) => event.execute(...args));
  }
}

// --- INICIALIZAÇÃO DA API EXPRESS ---
const app = express();
const PORT = process.env.API_PORT || 3000;

app.set('discordClient', client);

// --- CONFIGURAÇÕES DO MIDDLEWARE ---
app.use(express.json());

// <-- 2. CONFIGURE O CORS PARA ACEITAR A ORIGEM DO FRONT-END
const corsOptions = {
  origin: 'https://rocketseat-tools.vercel.app' 
};
app.use(cors(corsOptions));
// <-- FIM DA CONFIGURAÇÃO

// --- ROTAS DA API ---
app.get('/status', (req, res) => {
  res.status(200).json({ status: 'API está online' });
});

// Registra as rotas de mensagens e de guilds, ambas protegidas pela chave de API
app.use('/api/v1/messages', apiKeyAuth, messageRoutes);
app.use('/api/v1/guilds', apiKeyAuth, guildsRoutes);

// --- INICIALIZAÇÃO GERAL ---
client.login(process.env.DISCORD_BOT_TOKEN)
  .then(() => {
    initializeScheduler(client);
    app.listen(PORT, () => {
      console.log(`Servidor da API rodando na porta ${PORT}`);
    });
  })
  .catch(err => {
    console.error("Erro ao fazer login no discord:", err);
  });