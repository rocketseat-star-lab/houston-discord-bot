// --- GLOBAL BIGINT SERIALIZATION FIX ---
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

import express from 'express';
import cors from 'cors';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import 'dotenv/config';

import { registerModules, initializeModules, shutdownModules } from './core/dispatcher';
import type { FeatureModule } from './core/module';
import { apiKeyAuth } from './api/middlewares/apiKeyAuth';

// --- Shared API routes (not owned by any specific module) ---
import healthRoutes from './api/routes/health.routes';
import guildsRoutes from './api/routes/guilds.routes';
import webhooksRoutes from './api/routes/webhooks.routes';
import dmRoutes from './api/routes/dm.routes';
import jobsRoutes from './api/routes/jobs.routes';

// --- Feature Modules ---
import { aiAgentModule } from './modules/ai-agent/index';
import { moderationModule } from './modules/moderation/index';
import { reportsModule } from './modules/reports/index';
import { schedulerModule } from './modules/scheduler/index';
import { metricsModule } from './modules/metrics/index';

// --- Module Registry ---
const modules: FeatureModule[] = [
  moderationModule,
  aiAgentModule,
  reportsModule,
  schedulerModule,
  metricsModule,
];

// --- Discord Client ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User,
  ],
});

// --- Express App ---
const app = express();
const PORT = process.env.API_PORT || 3000;

app.set('discordClient', client);
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

// --- Shared API Routes (not owned by modules) ---
app.use('/api/v1/health', healthRoutes);

// Legacy routes (kept for compatibility)
app.get('/status', (req, res) => {
  res.status(200).json({ status: 'API está online' });
});

app.get('/healthcheck', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Shared routes protected by API key
app.use('/api/v1/guilds', apiKeyAuth, guildsRoutes);
app.use('/api/v1/webhooks', apiKeyAuth, webhooksRoutes);
app.use('/api/v1/dm', apiKeyAuth, dmRoutes);
app.use('/api/v1/jobs', apiKeyAuth, jobsRoutes);

// --- Register Feature Modules (event handlers, module API routes, schedulers) ---
registerModules(client, app, modules);

// --- Ready event ---
client.once('ready', async (readyClient) => {
  console.log(`✅ 🤖 Discord bot ready! Logged in as ${readyClient.user.tag}`);
  console.log(`📊 Connected to ${readyClient.guilds.cache.size} server(s)`);

  await initializeModules(client, modules);
  console.log('✅ All modules initialized');
});

// --- Graceful Shutdown ---
async function gracefulShutdown(signal: string) {
  console.log(`\n[shutdown] Received ${signal}, shutting down gracefully...`);
  await shutdownModules(modules);
  client.destroy();
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// --- Startup ---
console.log('🚀 Starting Houston Discord Bot...');
console.log('⏳ Connecting to Discord...');

client.login(process.env.DISCORD_BOT_TOKEN)
  .then(() => {
    console.log('✅ 🤖 Discord bot logged in successfully!');

    app.listen(PORT, () => {
      console.log(`✅ 🌐 API Server is running on port ${PORT}`);
      console.log('🎉 Houston Discord Bot is fully operational!');
    });
  })
  .catch(err => {
    console.error("❌ 🤖 Failed to login to Discord:", err);
  });
