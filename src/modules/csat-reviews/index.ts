import type { FeatureModule } from '../../core/module';
import { CSAT_REVIEWS_CONFIG } from './config';
import { dispatchCsatReviews } from './services/dispatcher';
import routes from './api/routes';

export const csatReviewsModule: FeatureModule = {
  name: 'csat-reviews',
  description:
    'Posta os feedbacks CSAT da plataforma no Slack, em uma thread por dia. Operado pela página de Educação no Tools.',

  routes,

  schedulers: [
    {
      name: 'daily-dispatch',
      cron: CSAT_REVIEWS_CONFIG.cron,
      timezone: CSAT_REVIEWS_CONFIG.timezone,
      handler: async () => {
        const result = await dispatchCsatReviews();
        console.log(
          `[csat-reviews] Daily dispatch: dateCovered=${result.dateCovered} feedbacks=${result.feedbacks.length} dryRun=${result.dryRun}`
        );
      },
    },
  ],
};
