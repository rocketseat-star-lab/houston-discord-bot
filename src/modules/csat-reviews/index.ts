import type { FeatureModule } from '../../core/module';
import { closeSkylabPool } from '../../core/db/skylab';
import { CSAT_REVIEWS_CONFIG } from './config';
import { dispatchCsatReviews } from './services/dispatcher';
import { getCsatReviewsConfig } from './services/toolsConfigClient';
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
      // O scheduler checa o flag `enabled` por conta propria. O dispatcher
      // nao gateia mais por esse flag — assim o botao "Enviar agora" do
      // Tools sempre executa quando acionado manualmente, sem depender do
      // toggle de envio automatico.
      handler: async () => {
        const config = await getCsatReviewsConfig();
        if (!config?.enabled) {
          console.log('[csat-reviews] Daily dispatch skipped: envio automático desativado');
          return;
        }
        const result = await dispatchCsatReviews();
        console.log(
          `[csat-reviews] Daily dispatch: dateCovered=${result.dateCovered} feedbacks=${result.feedbacks.length} dryRun=${result.dryRun}`
        );
      },
    },
  ],

  // Fecha o pool do skylab no shutdown. Como o pool é compartilhado entre
  // módulos do bot, hoje só o csat-reviews consome — quando outro módulo
  // passar a usar, mover este close pra um lugar global (ou aceitar que
  // qualquer um dos módulos consumidores seja o "dono" do encerramento).
  shutdown: async () => {
    await closeSkylabPool();
  },
};
