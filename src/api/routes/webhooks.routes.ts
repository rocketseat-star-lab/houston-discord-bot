import { Router } from 'express';
import { createWebhook } from '../controllers/webhooksController';

const router = Router();

// Define a rota POST para a raiz deste router
router.post('/', createWebhook);

export default router;