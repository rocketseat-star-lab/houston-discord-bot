-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'SENT', 'ERROR_SENDING', 'ERROR_CHANNEL_NOT_FOUND');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "scheduled_messages" (
    "id" BIGSERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel_id" TEXT NOT NULL,
    "message_content" TEXT NOT NULL,
    "schedule_time" TIMESTAMP(3) NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "scheduled_messages_pkey" PRIMARY KEY ("id")
);
