import type { Client } from 'discord.js';
import type { Router } from 'express';

export interface FeatureModule {
  /** Unique module name (used in logs and debug) */
  name: string;

  /** Short description of purpose */
  description: string;

  /** Discord event handlers. Key = discord.js event name, value = async handler. */
  handlers?: Record<string, (...args: any[]) => Promise<void>>;

  /** Express sub-router mounted at /api/v1/<name> */
  routes?: Router;

  /** Scheduled jobs via node-cron */
  schedulers?: Array<{
    name: string;
    cron: string;
    timezone?: string;
    handler: () => Promise<void>;
  }>;

  /** Runs once after client is ready. Use for: loading caches, cleaning orphan state, validating config. */
  initialize?: (client: Client) => Promise<void>;

  /** Runs on graceful shutdown (SIGINT/SIGTERM). Use for: closing active sessions, flushing buffers. */
  shutdown?: () => Promise<void>;
}
