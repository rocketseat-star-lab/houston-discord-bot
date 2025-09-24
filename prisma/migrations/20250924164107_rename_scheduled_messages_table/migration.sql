-- CreateEnum
CREATE TYPE "houston_bot"."MessageStatus" AS ENUM ('PENDING', 'SENT', 'ERROR_SENDING', 'ERROR_CHANNEL_NOT_FOUND');

-- CreateTable
CREATE TABLE "houston_bot"."houston_bot_scheduled_messages" (
    "id" BIGSERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guild_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "message_content" TEXT NOT NULL,
    "schedule_time" TIMESTAMP(3) NOT NULL,
    "status" "houston_bot"."MessageStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT,
    "message_url" TEXT,

    CONSTRAINT "houston_bot_scheduled_messages_pkey" PRIMARY KEY ("id")
);
