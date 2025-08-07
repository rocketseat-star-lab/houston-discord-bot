import { Request, Response } from 'express';
import { Client, TextChannel } from 'discord.js';

interface CreateWebhookBody {
  channel_id: string;
  user_profile: {
    name: string;
    avatar_url: string;
  };
}

/**
 * Cria um novo webhook em um canal específico.
 */
export async function createWebhook(req: Request<{}, {}, CreateWebhookBody>, res: Response) {
  const { channel_id, user_profile } = req.body;
  const discordClient = req.app.get('discordClient') as Client;

  // Validação do payload
  if (!channel_id || !user_profile || !user_profile.name || !user_profile.avatar_url) {
    return res.status(400).json({ error: 'Payload incompleto. É necessário channel_id e um user_profile com name e avatar_url.' });
  }

  try {
    const channel = await discordClient.channels.fetch(channel_id);

    // Garante que o canal é um canal de texto de um servidor
    if (!(channel instanceof TextChannel)) {
      return res.status(400).json({ error: 'O ID fornecido não pertence a um canal de texto válido.' });
    }

    // Cria o webhook com os dados fornecidos
    const webhook = await channel.createWebhook({
      name: user_profile.name,
      avatar: user_profile.avatar_url,
      reason: `Webhook criado via API para a plataforma Houston`,
    });

    // Responde com a URL do webhook criado
    res.status(201).json({ webhookUrl: webhook.url });

  } catch (error) {
    console.error('Erro ao criar webhook:', error);
    // Erros comuns aqui são falta de permissão (ManageWebhooks) ou URL de avatar inválida.
    res.status(500).json({ error: 'Não foi possível criar o webhook. Verifique as permissões do bot e os dados fornecidos.' });
  }
}