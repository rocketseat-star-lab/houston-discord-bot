import { Request, Response, NextFunction } from 'express';
import 'dotenv/config';

export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['authorization'];
  const expectedApiKey = `ApiKey ${process.env.INTERNAL_API_KEY}`;

  if (!process.env.INTERNAL_API_KEY) {
    console.error('A chave de API interna não está configurada no .env');
    return res.status(500).json({ error: 'Erro de configuração do servidor.' });
  }

  if (!apiKey || apiKey !== expectedApiKey) {
    console.warn('Tentativa de acesso não autorizado à API.');
    return res.status(403).json({ error: 'Acesso proibido: chave de API inválida.' });
  }

  next();
}