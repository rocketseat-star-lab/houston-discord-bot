import { Router } from 'express';
import { scheduleMessage, sendImmediateMessage } from '../controllers/messageController';

const router = Router();

router.post('/schedule', scheduleMessage);
router.post('/send-now', sendImmediateMessage);

export default router;