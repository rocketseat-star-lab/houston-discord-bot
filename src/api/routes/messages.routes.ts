import { Router } from 'express';
import {
  createScheduledMessage,
  listScheduledMessages,
  updateScheduledMessage,
  deleteScheduledMessage,
  sendImmediateMessage,
} from '../controllers/messageController';

const router = Router();

// Rota para envio imediato de mensagens (ação direta)
router.post('/send-now', sendImmediateMessage);

// --- Rotas RESTful para o recurso "Mensagens Agendadas" ---

// Listar todas as mensagens agendadas (com filtro opcional por status)
// GET /api/v1/messages/scheduled?status=PENDING
router.get('/scheduled', listScheduledMessages);

// Criar (agendar) uma nova mensagem
// POST /api/v1/messages/scheduled
router.post('/scheduled', createScheduledMessage);

// Atualizar uma mensagem agendada existente
// PUT /api/v1/messages/scheduled/:id
router.put('/scheduled/:id', updateScheduledMessage);

// Deletar uma mensagem agendada
// DELETE /api/v1/messages/scheduled/:id
router.delete('/scheduled/:id', deleteScheduledMessage);

export default router;