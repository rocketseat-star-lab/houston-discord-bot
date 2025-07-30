import axios from 'axios';
import 'dotenv/config';

const aiApi = axios.create({
  baseURL: process.env.AI_SERVICE_URL,
});

/**
 * Envia uma mensagem para o serviço de IA e retorna a resposta.
 * @param userMessage - A mensagem enviada pelo usuário.
 * @returns A resposta da IA em markdown ou null em caso de erro.
 */
export async function getAiResponse(userMessage: string): Promise<string | null> {
  try {
    const response = await aiApi.post<{ reply: string }>('/v1/chat', {
      message: userMessage,
    });

    if (response.data && response.data.reply) {
      return response.data.reply;
    }

    return 'Desculpe, não consegui obter uma resposta no momento.';
  } catch (error) {
    if (error instanceof Error) {
        console.error('Erro ao se comunicar com o serviço de IA:', error.message);
    } else {
        console.error('Ocorreu um erro desconhecido no serviço de IA.');
    }
    return null;
  }
}