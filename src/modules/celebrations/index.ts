import type { FeatureModule } from '../../core/module';
import { CELEBRATIONS_CONFIG } from './config';
import { onInteraction } from './handlers/onInteraction';
import { registerCelebrationsSlashCommands } from './commands/register';
import { dispatchCelebrations } from './services/dispatcher';

export const celebrationsModule: FeatureModule = {
  name: 'celebrations',
  description: 'Dispara aniversários (pessoais e de empresa) no Slack com imagens geradas pelo image-generator',

  handlers: {
    interactionCreate: onInteraction,
  },

  schedulers: [
    {
      name: 'daily-dispatch',
      cron: CELEBRATIONS_CONFIG.cron,
      timezone: CELEBRATIONS_CONFIG.timezone,
      handler: async () => {
        const result = await dispatchCelebrations();
        console.log(
          `[celebrations] Daily dispatch concluído: birthdays=${result.birthdays} anniversaries=${result.anniversaries} dates=${result.datesCovered.join(',')}`
        );
      },
    },
  ],

  async initialize(client) {
    const clientId = client.user?.id;
    if (clientId) {
      await registerCelebrationsSlashCommands(clientId);
    }
  },
};
