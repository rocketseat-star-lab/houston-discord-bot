import type { Client } from 'discord.js';
import type { Express } from 'express';
import cron from 'node-cron';
import type { FeatureModule } from './module';
import { apiKeyAuth } from '../api/middlewares/apiKeyAuth';

/**
 * Registers all modules: event handlers, API routes, and schedulers.
 * Each Discord event gets exactly ONE listener that dispatches to all interested modules.
 */
export function registerModules(
  client: Client,
  app: Express,
  modules: FeatureModule[]
): void {
  // --- Event Handlers ---
  const eventMap = new Map<string, Array<{ name: string; handler: (...args: any[]) => Promise<void> }>>();

  for (const mod of modules) {
    if (!mod.handlers) continue;
    for (const [eventName, handler] of Object.entries(mod.handlers)) {
      if (!eventMap.has(eventName)) {
        eventMap.set(eventName, []);
      }
      eventMap.get(eventName)!.push({ name: mod.name, handler });
    }
  }

  for (const [eventName, handlers] of eventMap) {
    client.on(eventName, async (...args: unknown[]) => {
      const results = await Promise.allSettled(
        handlers.map(({ name, handler }) =>
          handler(...args).catch((err: Error) => {
            console.error(`[${name}] Error in ${eventName}:`, err);
            throw err;
          })
        )
      );

      for (let i = 0; i < results.length; i++) {
        if (results[i].status === 'rejected') {
          console.error(`[dispatcher] Module "${handlers[i].name}" failed on "${eventName}"`);
        }
      }
    });
  }

  // --- API Routes ---
  for (const mod of modules) {
    if (mod.routes) {
      app.use(`/api/v1/${mod.name}`, apiKeyAuth, mod.routes);
      console.log(`[dispatcher] Registered API routes: /api/v1/${mod.name}`);
    }
  }

  // --- Schedulers ---
  for (const mod of modules) {
    if (!mod.schedulers) continue;
    for (const job of mod.schedulers) {
      const options: Record<string, any> = {};
      if (job.timezone) {
        options.timezone = job.timezone;
      }
      cron.schedule(job.cron, async () => {
        try {
          await job.handler();
        } catch (err) {
          console.error(`[${mod.name}] Scheduler "${job.name}" failed:`, err);
        }
      }, options);
      console.log(`[dispatcher] Registered scheduler: ${mod.name}/${job.name} (${job.cron})`);
    }
  }
}

/**
 * Initializes all modules sequentially (respects dependency order).
 */
export async function initializeModules(client: Client, modules: FeatureModule[]): Promise<void> {
  for (const mod of modules) {
    if (mod.initialize) {
      console.log(`[dispatcher] Initializing module: ${mod.name}`);
      await mod.initialize(client);
    }
  }
}

/**
 * Shuts down all modules in reverse order.
 */
export async function shutdownModules(modules: FeatureModule[]): Promise<void> {
  for (const mod of [...modules].reverse()) {
    if (mod.shutdown) {
      console.log(`[dispatcher] Shutting down module: ${mod.name}`);
      try {
        await mod.shutdown();
      } catch (err) {
        console.error(`[dispatcher] Error shutting down ${mod.name}:`, err);
      }
    }
  }
}
