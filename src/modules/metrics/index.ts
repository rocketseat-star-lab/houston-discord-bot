import type { FeatureModule } from '../../core/module';
import { METRICS_CONFIG } from './config';

import { onMemberAdd } from './handlers/onMemberAdd';
import { onMemberRemove } from './handlers/onMemberRemove';
import { onMessage } from './handlers/onMessage';
import { onReactionAdd } from './handlers/onReactionAdd';
import { onReactionRemove } from './handlers/onReactionRemove';
import { onVoiceState } from './handlers/onVoiceState';
import { onInteraction } from './handlers/onInteraction';

import { cleanupOrphanedSessions, closeAllActiveSessions } from './services/voiceService';
import { processExistingMembers } from './services/memberService';
import { setClient, runDailyReports, runWeeklyReports, runMonthlyReports } from './scheduler/reportScheduler';
import { registerSlashCommands } from './commands/register';

import metricsRoutes from './api/routes';

export const metricsModule: FeatureModule = {
  name: 'metrics',
  description: 'Discord activity metrics collection and report generation',

  handlers: {
    guildMemberAdd: onMemberAdd,
    guildMemberRemove: onMemberRemove,
    messageCreate: onMessage,
    messageReactionAdd: onReactionAdd,
    messageReactionRemove: onReactionRemove,
    voiceStateUpdate: onVoiceState,
    interactionCreate: onInteraction,
  },

  routes: metricsRoutes,

  schedulers: [
    {
      name: 'daily-report',
      cron: '1 0 * * *',        // 00:01 every day
      timezone: METRICS_CONFIG.timezone,
      handler: runDailyReports,
    },
    {
      name: 'weekly-report',
      cron: '0 18 * * 5',       // Friday 18:00
      timezone: METRICS_CONFIG.timezone,
      handler: runWeeklyReports,
    },
    {
      name: 'monthly-report',
      cron: '1 0 1 * *',        // 00:01 on the 1st of each month
      timezone: METRICS_CONFIG.timezone,
      handler: runMonthlyReports,
    },
  ],

  async initialize(client) {
    setClient(client);

    // Register slash commands (/report, /status-metrics) in allowed guilds
    const clientId = client.user?.id;
    if (clientId) {
      await registerSlashCommands(clientId);
    }

    // Clean up orphaned voice sessions from previous bot restart
    const cleaned = await cleanupOrphanedSessions();
    if (cleaned > 0) {
      console.log(`[metrics] Cleaned up ${cleaned} orphaned voice sessions`);
    }

    // Process existing members in allowed guilds
    for (const guild of client.guilds.cache.values()) {
      if (METRICS_CONFIG.allowedGuildIds.includes(guild.id)) {
        console.log(`[metrics] Processing existing members for guild: ${guild.name}`);
        await processExistingMembers(guild);
      }
    }
  },

  async shutdown() {
    const closed = await closeAllActiveSessions();
    if (closed > 0) {
      console.log(`[metrics] Closed ${closed} active voice sessions on shutdown`);
    }
  },
};
