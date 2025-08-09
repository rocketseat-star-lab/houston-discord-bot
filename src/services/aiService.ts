import axios from 'axios';
import 'dotenv/config';

const aiApi = axios.create({
  baseURL: process.env.AI_SERVICE_URL,
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.AI_SERVICE_API_KEY,
  }
});

/**
 * Envia uma mensagem para o serviço de IA e retorna a resposta.
 * @param userMessage - A mensagem enviada pelo usuário.
 * @returns A resposta da IA em markdown ou null em caso de erro.
 */
export async function getAiResponse(userMessage: string): Promise<string | null> {
  try {
    const response = await aiApi.post<{ response: string, message: string, success: boolean }>('/api/notion', {
      message: userMessage,
    });

    if (response.data && response.data.response) {
      return response.data.response;
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
