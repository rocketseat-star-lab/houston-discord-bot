export const CELEBRATIONS_CONFIG = {
  timezone: 'America/Sao_Paulo',
  cron: '0 30 11 * * *', // every day 11:30 in the configured timezone
  imageGeneratorUrl: process.env.IMAGE_GENERATOR_URL || 'https://image-generator-gold.vercel.app',
  slackChannelId: process.env.SLACK_CELEBRATIONS_CHANNEL_ID || '',
  // When true, the dispatcher resolves everything and returns the rendered
  // messages but does not post to Slack. Useful for safe testing.
  dryRun: process.env.CELEBRATIONS_DRY_RUN === 'true',
};
