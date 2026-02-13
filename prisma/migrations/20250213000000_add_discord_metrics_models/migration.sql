-- CreateTable
CREATE TABLE IF NOT EXISTS "houston_bot_current_members" (
    "id" BIGSERIAL NOT NULL,
    "guild_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "is_bot" BOOLEAN NOT NULL DEFAULT false,
    "joined_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "houston_bot_current_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "houston_bot_member_join_logs" (
    "id" BIGSERIAL NOT NULL,
    "guild_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "discriminator" TEXT,
    "avatar_url" TEXT,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_bot" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "houston_bot_member_join_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "houston_bot_member_leave_logs" (
    "id" BIGSERIAL NOT NULL,
    "guild_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "left_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "member_since" TIMESTAMP(3),
    "days_in_server" INTEGER,

    CONSTRAINT "houston_bot_member_leave_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "houston_bot_message_logs" (
    "id" BIGSERIAL NOT NULL,
    "message_id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "has_attachments" BOOLEAN NOT NULL DEFAULT false,
    "attachment_count" INTEGER NOT NULL DEFAULT 0,
    "has_links" BOOLEAN NOT NULL DEFAULT false,
    "link_count" INTEGER NOT NULL DEFAULT 0,
    "has_mentions" BOOLEAN NOT NULL DEFAULT false,
    "mention_count" INTEGER NOT NULL DEFAULT 0,
    "character_count" INTEGER NOT NULL DEFAULT 0,
    "word_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "houston_bot_message_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "houston_bot_moderation_bans" (
    "id" BIGSERIAL NOT NULL,
    "guild_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "moderator_id" TEXT,
    "moderator_tag" TEXT,
    "reason" TEXT NOT NULL,
    "permanent" BOOLEAN NOT NULL DEFAULT true,
    "banned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "revoked_by_id" TEXT,

    CONSTRAINT "houston_bot_moderation_bans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "houston_bot_moderation_timeouts" (
    "id" BIGSERIAL NOT NULL,
    "guild_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "moderator_id" TEXT,
    "moderator_tag" TEXT,
    "reason" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "revoked_by_id" TEXT,

    CONSTRAINT "houston_bot_moderation_timeouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "houston_bot_reaction_logs" (
    "id" BIGSERIAL NOT NULL,
    "message_id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "emoji_name" TEXT,
    "is_custom" BOOLEAN NOT NULL DEFAULT false,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "houston_bot_reaction_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "houston_bot_voice_activity_logs" (
    "id" BIGSERIAL NOT NULL,
    "guild_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL,
    "left_at" TIMESTAMP(3),
    "duration_sec" INTEGER,
    "was_muted" BOOLEAN NOT NULL DEFAULT false,
    "was_deafened" BOOLEAN NOT NULL DEFAULT false,
    "was_streaming" BOOLEAN NOT NULL DEFAULT false,
    "was_video" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "houston_bot_voice_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "houston_bot_current_members_guild_id_idx" ON "houston_bot_current_members"("guild_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "houston_bot_current_members_user_id_idx" ON "houston_bot_current_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "houston_bot_current_members_guild_id_user_id_key" ON "houston_bot_current_members"("guild_id", "user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "houston_bot_member_join_logs_guild_id_joined_at_idx" ON "houston_bot_member_join_logs"("guild_id", "joined_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "houston_bot_member_join_logs_user_id_idx" ON "houston_bot_member_join_logs"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "houston_bot_member_leave_logs_guild_id_left_at_idx" ON "houston_bot_member_leave_logs"("guild_id", "left_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "houston_bot_member_leave_logs_user_id_idx" ON "houston_bot_member_leave_logs"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "houston_bot_message_logs_message_id_key" ON "houston_bot_message_logs"("message_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "houston_bot_message_logs_guild_id_channel_id_created_at_idx" ON "houston_bot_message_logs"("guild_id", "channel_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "houston_bot_message_logs_guild_id_created_at_idx" ON "houston_bot_message_logs"("guild_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "houston_bot_message_logs_user_id_created_at_idx" ON "houston_bot_message_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "houston_bot_moderation_bans_guild_id_banned_at_idx" ON "houston_bot_moderation_bans"("guild_id", "banned_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "houston_bot_moderation_bans_guild_id_user_id_revoked_at_idx" ON "houston_bot_moderation_bans"("guild_id", "user_id", "revoked_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "houston_bot_moderation_bans_user_id_idx" ON "houston_bot_moderation_bans"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "houston_bot_moderation_timeouts_guild_id_applied_at_idx" ON "houston_bot_moderation_timeouts"("guild_id", "applied_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "houston_bot_moderation_timeouts_guild_id_expires_at_idx" ON "houston_bot_moderation_timeouts"("guild_id", "expires_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "houston_bot_moderation_timeouts_user_id_idx" ON "houston_bot_moderation_timeouts"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "houston_bot_reaction_logs_guild_id_channel_id_added_at_idx" ON "houston_bot_reaction_logs"("guild_id", "channel_id", "added_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "houston_bot_reaction_logs_message_id_idx" ON "houston_bot_reaction_logs"("message_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "houston_bot_reaction_logs_user_id_added_at_idx" ON "houston_bot_reaction_logs"("user_id", "added_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "houston_bot_voice_activity_logs_guild_id_channel_id_joined__idx" ON "houston_bot_voice_activity_logs"("guild_id", "channel_id", "joined_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "houston_bot_voice_activity_logs_guild_id_left_at_idx" ON "houston_bot_voice_activity_logs"("guild_id", "left_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "houston_bot_voice_activity_logs_user_id_joined_at_idx" ON "houston_bot_voice_activity_logs"("user_id", "joined_at");
