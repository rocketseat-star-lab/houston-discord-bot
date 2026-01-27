import { Router } from 'express';
import { listGuilds, listForumChannels, listGuildRoles, listGuildChannels } from '../controllers/guildsController';

const router = Router();

// Lista todos os servidores onde o bot está
router.get('/', listGuilds);

// Lista todos os canais de um servidor específico (incluindo fóruns)
router.get('/:guildId/forum-channels', listForumChannels);

// Lista todas as roles de um servidor
router.get('/:guildId/roles', listGuildRoles);

// Lista todos os canais de um servidor
router.get('/:guildId/channels', listGuildChannels);

export default router;