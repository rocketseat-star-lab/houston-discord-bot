import { Request, Response } from 'express';
import { Client } from 'discord.js';
import prisma from '../../services/prisma';

export const healthCheck = async (req: Request, res: Response) => {
  try {
    const client = req.app.get('discordClient') as Client;

    // Verifica o status do Discord bot
    const discordStatus = client.isReady() ? 'connected' : 'disconnected';

    // Verifica a conexão com o banco de dados
    let databaseStatus = 'connected';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      databaseStatus = 'disconnected';
    }

    const uptime = process.uptime();
    const timestamp = new Date().toISOString();

    const health = {
      status: 'healthy',
      timestamp,
      uptime: {
        seconds: Math.floor(uptime),
        formatted: formatUptime(uptime)
      },
      services: {
        discord: {
          status: discordStatus,
          guilds: client.guilds.cache.size,
          ping: client.ws.ping
        },
        database: {
          status: databaseStatus
        }
      },
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };

    const statusCode = (discordStatus === 'connected' && databaseStatus === 'connected') ? 200 : 503;

    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Failed to check health status'
    });
  }
};

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(' ');
}
