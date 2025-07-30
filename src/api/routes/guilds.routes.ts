import { Router } from 'express';
import { listGuilds } from '../controllers/guildsController';

const router = Router();

// Define a rota GET para a raiz deste router, que será /api/v1/guilds
router.get('/', listGuilds);

export default router;