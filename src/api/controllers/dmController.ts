import { Request, Response } from 'express';
import { Client } from 'discord.js';

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
      await user.send(content);
    } catch (dmError: any) {
      // Usuário pode ter DMs bloqueadas - retorna sucesso mesmo assim
      console.warn(`Não foi possível enviar DM para ${userId}:`, dmError.message);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Erro ao enviar DM:', error);
    res.status(500).json({ error: 'Erro interno do servidor ao enviar a mensagem.' });
  }
}
