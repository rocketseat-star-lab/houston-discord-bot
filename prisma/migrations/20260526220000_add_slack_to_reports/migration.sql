-- Migracao aditiva pra suportar reports do Slack alem dos do Discord.
-- Reports antigos ficam com platform='DISCORD' (default). Reports novos
-- do Slack passam platform='SLACK' explicito + slack_channel_id +
-- slack_thread_ts + slack_user_id. RAG filtra por platform pra nao
-- sugerir threads do Discord (cujos links nao funcionam mais) em
-- reports novos do Slack.

ALTER TABLE "houston_bot_reports"
  ALTER COLUMN "discord_thread_id" DROP NOT NULL,
  ALTER COLUMN "discord_user_id" DROP NOT NULL,
  ADD COLUMN "platform" TEXT NOT NULL DEFAULT 'DISCORD',
  ADD COLUMN "slack_channel_id" TEXT,
  ADD COLUMN "slack_thread_ts" TEXT,
  ADD COLUMN "slack_user_id" TEXT;

CREATE UNIQUE INDEX "uniq_slack_thread"
  ON "houston_bot_reports" ("slack_channel_id", "slack_thread_ts");

CREATE INDEX "houston_bot_reports_platform_idx"
  ON "houston_bot_reports" ("platform");
