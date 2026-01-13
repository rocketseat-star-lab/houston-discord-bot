import { Request, Response } from 'express';
import { Client } from 'discord.js';
import { discordLogger } from '../../services/discordLogger';

/**
 * Envia uma DM para um usuário.
 */
export async function sendDm(req: Request, res: Response) {
  const discordClient = req.app.get('discordClient') as Client;
  const { userId, content } = req.body;

  if (!discordClient || !discordClient.isReady()) {
    return res.status(503).json({ error: 'O cliente do Discord não está pronto ou disponível.' });
  }

  if (!userId || !content) {
    return res.status(400).json({ error: 'userId e content são obrigatórios.' });
  }

  try {
    const user = await discordClient.users.fetch(userId);

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    try {
      const message = await user.send(content);

      // Log de sucesso no Discord
      await discordLogger.logDmSent(userId, content, true);

      res.status(200).json({ success: true, messageId: message.id });
    } catch (dmError: any) {
      // Usuário tem DMs bloqueadas
      console.warn(`Não foi possível enviar DM para ${userId}:`, dmError.message);

      // Log de falha no Discord
      await discordLogger.logDmSent(userId, content, false, dmError.message);

      return res.status(403).json({
        error: 'Não foi possível enviar a mensagem. O usuário pode ter DMs desabilitadas.'
      });
    }
  } catch (error: any) {
    console.error('Erro ao enviar DM:', error);

    // Log de erro no Discord
    await discordLogger.logError('sendDm', error);

    res.status(500).json({ error: 'Erro interno do servidor ao enviar a mensagem.' });
  }
}
