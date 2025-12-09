// --- CORREÇÃO GLOBAL PARA SERIALIZAÇÃO DE BIGINT ---
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { Client, GatewayIntentBits, Collection } from 'discord.js';
import 'dotenv/config';

import { apiKeyAuth } from './api/middlewares/apiKeyAuth';
import messageRoutes from './api/routes/messages.routes';
import guildsRoutes from './api/routes/guilds.routes';
import webhooksRoutes from './api/routes/webhooks.routes';
import healthRoutes from './api/routes/health.routes';
import jobsRoutes from './api/routes/jobs.routes';
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

const allowedOrigins = [
    'https://rocketseat-tools.vercel.app',
    'http://localhost:5173'
];
const ngrokRegex = /^https:\/\/.*\.ngrok-free\.app$/;

const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    if (!origin || allowedOrigins.includes(origin) || ngrokRegex.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Não permitido por CORS'));
    }
  }
};
app.use(cors(corsOptions));

// --- ROTAS DA API ---
// Rota de healthcheck pública (sem autenticação)
app.use('/api/v1/health', healthRoutes);

// Rota legada de status (mantida por compatibilidade)
app.get('/status', (req, res) => {
  res.status(200).json({ status: 'API está online' });
});

app.get('/healthcheck', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Registra as rotas, todas protegidas pela chave de API
app.use('/api/v1/messages', apiKeyAuth, messageRoutes);
app.use('/api/v1/guilds', apiKeyAuth, guildsRoutes);
app.use('/api/v1/webhooks', apiKeyAuth, webhooksRoutes);
app.use('/api/v1/jobs', apiKeyAuth, jobsRoutes);

// --- INICIALIZAÇÃO GERAL ---
console.log('🚀 Starting Houston Discord Bot...');
console.log('⏳ Connecting to Discord...');

client.login(process.env.DISCORD_BOT_TOKEN)
  .then(() => {
    console.log('✅ 🤖 Discord bot logged in successfully!');

    console.log('⏳ Initializing scheduler...');
    initializeScheduler(client);
    console.log('✅ 📅 Scheduler initialized!');

    app.listen(PORT, () => {
      console.log(`✅ 🌐 API Server is running on port ${PORT}`);
      console.log('🎉 Houston Discord Bot is fully operational!');
    });
  })
  .catch(err => {
    console.error("❌ 🤖 Failed to login to Discord:", err);
  });