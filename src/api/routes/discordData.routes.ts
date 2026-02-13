import { Router } from 'express';
import {
  getNewJoinsLeaves,
  getMessageAggregates,
  getVoiceAggregates,
  getReactionAggregates,
  getUserProfile,
  getModerationHistory,
  getCurrentMembers,
  getAvailableGuilds,
  populateJoinHistory,
} from '../controllers/discordDataController';

const router = Router();

/**
 * GET /api/v1/discord-data/guilds
 * Retorna todos os servidores (guilds) que o bot está presente
 */
router.get('/guilds', getAvailableGuilds);

/**
 * GET /api/v1/discord-data/guilds/:guildId/members
 * Retorna todos os membros atuais do servidor via Discord API
 * Params: guildId (URL)
 * Query params: search?, isBot?, limit?
 */
router.get('/guilds/:guildId/members', getCurrentMembers);

/**
 * POST /api/v1/discord-data/guilds/:guildId/populate-join-history
 * Popula a tabela MemberJoinLog com base nos membros atuais do servidor
 * Útil para criar histórico de membros que entraram enquanto o bot estava offline
 * Params: guildId (URL)
 */
router.post('/guilds/:guildId/populate-join-history', populateJoinHistory);

/**
 * GET /api/v1/discord-data/members/new
 * Retorna novos joins e leaves desde um timestamp (PULL endpoint para sync)
 * Query params: guildId (required), since (timestamp ISO)
 */
router.get('/members/new', getNewJoinsLeaves);

/**
 * GET /api/v1/discord-data/messages/aggregate
 * Retorna agregações de mensagens (PULL endpoint para sync)
 * Query params: guildId (required), since (timestamp), groupBy='day'
 */
router.get('/messages/aggregate', getMessageAggregates);

/**
 * GET /api/v1/discord-data/voice/aggregate
 * Retorna agregações de atividade de voz (PULL endpoint para sync)
 * Query params: guildId (required), since (timestamp)
 */
router.get('/voice/aggregate', getVoiceAggregates);

/**
 * GET /api/v1/discord-data/reactions/aggregate
 * Retorna agregações de reações (PULL endpoint para sync)
 * Query params: guildId (required), since (timestamp)
 */
router.get('/reactions/aggregate', getReactionAggregates);

/**
 * GET /api/v1/discord-data/users/:userId/profile
 * Retorna perfil completo e granular de um usuário (GET sob demanda)
 * Params: userId (URL)
 * Query params: guildId (required), startDate?, endDate?
 */
router.get('/users/:userId/profile', getUserProfile);

/**
 * GET /api/v1/discord-data/users/:userId/moderation
 * Retorna histórico completo de moderação de um usuário (GET sob demanda)
 * Params: userId (URL)
 * Query params: guildId (required)
 */
router.get('/users/:userId/moderation', getModerationHistory);

export default router;
