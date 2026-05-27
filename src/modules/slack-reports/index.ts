import type { Express } from 'express';
import routes, { shutdownSlackReports } from './api/routes';

/**
 * Modulo de bug reports no Slack — espelha o `reports/` do Discord, mas
 * vive fora do `FeatureModule` padrao porque suas rotas precisam de
 * middleware diferente (raw body + verificacao de assinatura do Slack)
 * ao inves do `apiKeyAuth` que o dispatcher aplica.
 *
 * O setup expoe `setupSlackReports(app)` pra ser chamado em `index.ts`
 * apos `app.use(express.json())`. As rotas internas usam `express.raw`
 * proprio.
 */
export function setupSlackReports(app: Express): void {
  app.use('/api/v1/slack-reports', routes);
  console.log('[slack-reports] Routes mounted at /api/v1/slack-reports');
}

export function teardownSlackReports(): void {
  shutdownSlackReports();
}
