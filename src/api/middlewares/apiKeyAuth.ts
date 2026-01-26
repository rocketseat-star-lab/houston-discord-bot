import { Request, Response, NextFunction } from 'express';

/**
 * Middleware para autenticar chamadas internas via API Key
 */
export const apiKeyAuth = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  const expectedKey = process.env.INTERNAL_API_KEY;

  if (!expectedKey) {
    console.error('[apiKeyAuth] INTERNAL_API_KEY not configured in environment');
    return res.status(500).json({ error: 'Internal configuration error' });
  }

  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  if (apiKey !== expectedKey) {
    return res.status(403).json({ error: 'Invalid API key' });
  }

  next();
};
