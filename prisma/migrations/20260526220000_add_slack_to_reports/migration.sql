-- Migracao idempotente: deixa o schema dos reports no estado final
-- (Discord + Slack) independente de qual era o estado anterior do banco.
--
-- Contexto: o banco do bot em producao chegou ao estado atual sem nunca
-- ter migration explicita que criasse `houston_bot_reports` — outras
-- migrations historicas (`add_search_vector`, `update_embedding_vector_3072`)
-- so ALTERam a tabela, assumindo que ela ja existia. A primeira vez que
-- isso ficou claro foi quando uma migration tentou ALTER em ambiente onde
-- a tabela nao existia mais e falhou com `relation does not exist`. Pra
-- evitar repetir esse problema, esta migration cria as tabelas se
-- faltarem (CREATE TABLE IF NOT EXISTS) e adiciona as novas colunas com
-- ADD COLUMN IF NOT EXISTS — sem suposicoes sobre estado anterior.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "houston_bot_reports" (
  "id" BIGSERIAL PRIMARY KEY,
  "discord_thread_id" TEXT,
  "discord_user_id" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "solution" TEXT,
  "category" TEXT,
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "search_vector" tsvector
);

CREATE TABLE IF NOT EXISTS "houston_bot_report_embeddings" (
  "id" BIGSERIAL PRIMARY KEY,
  "report_id" BIGINT NOT NULL UNIQUE
    REFERENCES "houston_bot_reports"("id") ON DELETE CASCADE,
  "embedding" vector(3072) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Idempotente: se a tabela ja existia com discord_thread_id NOT NULL,
-- vira nullable. Se ja era nullable, no-op.
ALTER TABLE "houston_bot_reports"
  ALTER COLUMN "discord_thread_id" DROP NOT NULL;
ALTER TABLE "houston_bot_reports"
  ALTER COLUMN "discord_user_id" DROP NOT NULL;

-- Colunas novas para o caminho Slack. `IF NOT EXISTS` cobre ambientes
-- onde a tabela ja tinha sido criada acima por este mesmo arquivo.
ALTER TABLE "houston_bot_reports"
  ADD COLUMN IF NOT EXISTS "platform" TEXT NOT NULL DEFAULT 'DISCORD';
ALTER TABLE "houston_bot_reports"
  ADD COLUMN IF NOT EXISTS "slack_channel_id" TEXT;
ALTER TABLE "houston_bot_reports"
  ADD COLUMN IF NOT EXISTS "slack_thread_ts" TEXT;
ALTER TABLE "houston_bot_reports"
  ADD COLUMN IF NOT EXISTS "slack_user_id" TEXT;

-- Indices e constraints (idempotentes).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'houston_bot_reports_discord_thread_id_key'
  ) THEN
    ALTER TABLE "houston_bot_reports"
      ADD CONSTRAINT "houston_bot_reports_discord_thread_id_key"
      UNIQUE ("discord_thread_id");
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_slack_thread"
  ON "houston_bot_reports" ("slack_channel_id", "slack_thread_ts");

CREATE INDEX IF NOT EXISTS "houston_bot_reports_platform_idx"
  ON "houston_bot_reports" ("platform");

CREATE INDEX IF NOT EXISTS "houston_bot_reports_created_at_idx"
  ON "houston_bot_reports" ("created_at");

CREATE INDEX IF NOT EXISTS "houston_bot_reports_discord_thread_id_idx"
  ON "houston_bot_reports" ("discord_thread_id");

CREATE INDEX IF NOT EXISTS "houston_bot_reports_search_vector_idx"
  ON "houston_bot_reports" USING gin ("search_vector");

CREATE INDEX IF NOT EXISTS "houston_bot_report_embeddings_report_id_idx"
  ON "houston_bot_report_embeddings" ("report_id");
