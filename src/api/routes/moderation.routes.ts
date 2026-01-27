import { Router } from 'express';
import { syncRules, getCacheStatus, getDebugInfo, revokeTimeout, revokeBan } from '../controllers/moderationController';
import { apiKeyAuth } from '../middlewares/apiKeyAuth';

const router = Router();

/**
 * POST /api/v1/moderation/rules/sync
 * Recebe regras do backend e sincroniza no cache local
 */
router.post('/rules/sync', apiKeyAuth, syncRules);

/**
 * GET /api/v1/moderation/status
 * Retorna informações sobre o cache de regras
 */
router.get('/status', apiKeyAuth, getCacheStatus);

/**
 * GET /api/v1/moderation/debug
 * Retorna informações de debug sobre comunicação com o backend
 */
router.get('/debug', apiKeyAuth, getDebugInfo);

/**
 * POST /api/v1/moderation/timeouts/:guildId/:userId/revoke
 * Revoga um timeout no Discord
 */
router.post('/timeouts/:guildId/:userId/revoke', apiKeyAuth, revokeTimeout);

/**
 * POST /api/v1/moderation/bans/:guildId/:userId/revoke
 * Revoga um ban no Discord
 */
router.post('/bans/:guildId/:userId/revoke', apiKeyAuth, revokeBan);

export default router;
