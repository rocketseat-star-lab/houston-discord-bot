import { Router } from 'express';
import { createForumThread, closeForumThread } from '../controllers/forumController';

const router = Router();

// Cria uma nova thread em um canal de forum
router.post('/', createForumThread);

// Fecha/arquiva uma thread de forum
router.post('/:threadId/close', closeForumThread);

export default router;
