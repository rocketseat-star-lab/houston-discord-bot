-- CreateTable
CREATE TABLE "metrics_members" (
    "id" SERIAL NOT NULL,
    "guild_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "discriminator" TEXT,
    "is_bot" BOOLEAN NOT NULL DEFAULT false,
    "joined_at" TIMESTAMP(3) NOT NULL,
    "left_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "nickname" TEXT,

    CONSTRAINT "metrics_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metrics_join_leave_events" (
    "id" SERIAL NOT NULL,
    "guild_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metrics_join_leave_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metrics_message_events" (
    "id" SERIAL NOT NULL,
    "message_id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "channel_name" TEXT,
    "category_name" TEXT,
    "content_length" INTEGER,
    "has_embed" BOOLEAN NOT NULL DEFAULT false,
    "has_attachment" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metrics_message_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metrics_reaction_events" (
    "id" SERIAL NOT NULL,
    "message_id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metrics_reaction_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metrics_voice_events" (
    "id" SERIAL NOT NULL,
    "guild_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "channel_id" TEXT,
    "channel_name" TEXT,
    "event_type" TEXT NOT NULL,
    "session_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metrics_voice_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metrics_active_voice_sessions" (
    "guild_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "discord_session_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "join_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metrics_active_voice_sessions_pkey" PRIMARY KEY ("guild_id","user_id","discord_session_id")
);

-- CreateTable
CREATE TABLE "metrics_completed_voice_sessions" (
    "id" SERIAL NOT NULL,
    "guild_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "discord_session_id" TEXT,
    "join_timestamp" TIMESTAMP(3) NOT NULL,
    "leave_timestamp" TIMESTAMP(3) NOT NULL,
    "duration_seconds" INTEGER NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metrics_completed_voice_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "metrics_members_guild_id_user_id_key" ON "metrics_members"("guild_id", "user_id");

-- CreateIndex
CREATE INDEX "metrics_members_guild_id_is_active_idx" ON "metrics_members"("guild_id", "is_active");

-- CreateIndex
CREATE INDEX "metrics_members_is_active_left_at_idx" ON "metrics_members"("is_active", "left_at");

-- CreateIndex
CREATE INDEX "metrics_join_leave_events_guild_id_created_at_idx" ON "metrics_join_leave_events"("guild_id", "created_at");

-- CreateIndex
CREATE INDEX "metrics_join_leave_events_guild_id_user_id_created_at_idx" ON "metrics_join_leave_events"("guild_id", "user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "metrics_message_events_message_id_key" ON "metrics_message_events"("message_id");

-- CreateIndex
CREATE INDEX "metrics_message_events_guild_id_created_at_idx" ON "metrics_message_events"("guild_id", "created_at");

-- CreateIndex
CREATE INDEX "metrics_message_events_guild_id_user_id_created_at_idx" ON "metrics_message_events"("guild_id", "user_id", "created_at");

-- CreateIndex
CREATE INDEX "metrics_reaction_events_guild_id_created_at_idx" ON "metrics_reaction_events"("guild_id", "created_at");

-- CreateIndex
CREATE INDEX "metrics_reaction_events_guild_id_user_id_created_at_idx" ON "metrics_reaction_events"("guild_id", "user_id", "created_at");

-- CreateIndex
CREATE INDEX "metrics_voice_events_guild_id_created_at_idx" ON "metrics_voice_events"("guild_id", "created_at");

-- CreateIndex
CREATE INDEX "metrics_voice_events_guild_id_user_id_created_at_idx" ON "metrics_voice_events"("guild_id", "user_id", "created_at");

-- CreateIndex
CREATE INDEX "metrics_completed_voice_sessions_guild_id_user_id_join_times_idx" ON "metrics_completed_voice_sessions"("guild_id", "user_id", "join_timestamp");

-- CreateIndex
CREATE INDEX "metrics_completed_voice_sessions_guild_id_join_timestamp_idx" ON "metrics_completed_voice_sessions"("guild_id", "join_timestamp");

-- CreateIndex
CREATE INDEX "metrics_completed_voice_sessions_leave_timestamp_idx" ON "metrics_completed_voice_sessions"("leave_timestamp");

-- CreateTable
CREATE TABLE "metrics_report_snapshots" (
    "id" SERIAL NOT NULL,
    "guild_id" TEXT NOT NULL,
    "report_type" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metrics_report_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "metrics_report_snapshots_guild_id_report_type_period_start_key" ON "metrics_report_snapshots"("guild_id", "report_type", "period_start");

-- CreateIndex
CREATE INDEX "metrics_report_snapshots_guild_id_report_type_created_at_idx" ON "metrics_report_snapshots"("guild_id", "report_type", "created_at");
