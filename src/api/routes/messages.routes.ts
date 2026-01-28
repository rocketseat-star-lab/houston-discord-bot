import { Router } from 'express';
import {
  createScheduledMessage,
  listScheduledMessages,
  updateScheduledMessage,
  deleteScheduledMessage,
  sendImmediateMessage,
  editSentMessage,
  deleteSentMessage,
  listSentMessages,
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

// Lista todas as mensagens já enviadas (para cleanup de imagens)
router.get('/sent', listSentMessages);

// Edita o conteúdo de uma mensagem já enviada ao Discord
router.patch('/sent/:id', editSentMessage);

// Deleta uma mensagem já enviada do Discord e do nosso banco
router.delete('/sent/:id', deleteSentMessage);


export default router;