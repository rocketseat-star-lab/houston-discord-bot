-- Snapshot local das regras de moderacao (sobrevive a deploy/restart).
CREATE TABLE IF NOT EXISTS "houston_bot_moderation_rule_snapshot" (
    "id" TEXT NOT NULL,
    "rules" JSONB NOT NULL,
    "rule_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "houston_bot_moderation_rule_snapshot_pkey" PRIMARY KEY ("id")
);
