import { Router } from 'express';
import { sendDm } from '../controllers/dmController';

const router = Router();

// Envia uma DM para um usuário
router.post('/', sendDm);

export default router;
