import { Router } from 'express';
import { listGuilds, listForumChannels } from '../controllers/guildsController';

const router = Router();

// Lista todos os servidores onde o bot está
router.get('/', listGuilds);

// Lista todos os canais de um servidor específico (incluindo fóruns)
router.get('/:guildId/forum-channels', listForumChannels);

export default router;