import { Router } from 'express';
import {
  listGuilds,
  listJobChannels,
  createJobThread,
  closeJobThread,
  sendJobDm,
  notifyNewJobPosting,
} from '../controllers/jobsController';

const router = Router();

// Lista servidores onde o bot está
router.get('/guilds', listGuilds);

// Lista canais permitidos para vagas de um servidor
router.get('/guilds/:guildId/channels', listJobChannels);

// Cria uma thread de vaga
router.post('/forum-threads', createJobThread);

// Fecha/arquiva uma thread de vaga
router.post('/forum-threads/:threadId/close', closeJobThread);

// Envia DM para um usuário
router.post('/dm', sendJobDm);

// Notifica moderação sobre nova vaga
router.post('/notify-new', notifyNewJobPosting);

export default router;
