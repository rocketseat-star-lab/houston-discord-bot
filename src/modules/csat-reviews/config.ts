export const CSAT_REVIEWS_CONFIG = {
  timezone: 'America/Sao_Paulo',
  cron: '0 0 8 * * 1-5', // seg-sex 08:00 BRT
  dryRun: process.env.CSAT_REVIEWS_DRY_RUN === 'true',
};
