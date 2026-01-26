import { Router } from 'express';
import { syncRules, getCacheStatus } from '../controllers/moderationController';
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

export default router;
