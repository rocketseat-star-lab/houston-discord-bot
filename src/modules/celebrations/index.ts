import type { FeatureModule } from '../../core/module';
import { CELEBRATIONS_CONFIG } from './config';
import { dispatchCelebrations } from './services/dispatcher';
import routes from './api/routes';

export const celebrationsModule: FeatureModule = {
  name: 'celebrations',
  description:
    'Dispara aniversários (pessoais e de empresa) no Slack com imagens geradas pelo image-generator. Operado pela página de RH no Tools.',

  // Sem handlers de Discord — esta feature é 100% Slack.
  // A administração acontece pelo painel /hr/boosters do Tools, que chama
  // os endpoints internos abaixo via api key.
  routes,

  schedulers: [
    {
      name: 'daily-dispatch',
      cron: CELEBRATIONS_CONFIG.cron,
      timezone: CELEBRATIONS_CONFIG.timezone,
      handler: async () => {
        const result = await dispatchCelebrations();
        console.log(
          `[celebrations] Daily dispatch concluído: birthdays=${result.birthdays} anniversaries=${result.anniversaries} dryRun=${result.dryRun} dates=${result.datesCovered.join(',')}`
        );
      },
    },
  ],
};
