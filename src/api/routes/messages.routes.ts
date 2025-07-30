import { Router } from 'express';
import {
  createScheduledMessage,
  listScheduledMessages,
  updateScheduledMessage,
  deleteScheduledMessage,
  sendImmediateMessage,
  editSentMessage,
  deleteSentMessage,
} from '../controllers/messageController';

const router = Router();

// Rota para envio imediato de mensagens (ação direta)
router.post('/send-now', sendImmediateMessage);

// --- Rotas RESTful para o recurso "Mensagens Agendadas" ---
router.get('/scheduled', listScheduledMessages);
router.post('/scheduled', createScheduledMessage);
router.put('/scheduled/:id', updateScheduledMessage);
router.delete('/scheduled/:id', deleteScheduledMessage);

// --- Rotas para Mensagens JÁ ENVIADAS ---

// Edita o conteúdo de uma mensagem já enviada ao Discord
router.patch('/sent/:id', editSentMessage);

// Deleta uma mensagem já enviada do Discord e do nosso banco
router.delete('/sent/:id', deleteSentMessage);


export default router;