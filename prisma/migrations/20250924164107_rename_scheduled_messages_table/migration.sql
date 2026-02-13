-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'SENT', 'ERROR_SENDING', 'ERROR_CHANNEL_NOT_FOUND');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "houston_bot_scheduled_messages" (
    "id" BIGSERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guild_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "message_content" TEXT NOT NULL,
    "schedule_time" TIMESTAMP(3) NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT,
    "message_url" TEXT,

    CONSTRAINT "houston_bot_scheduled_messages_pkey" PRIMARY KEY ("id")
);
