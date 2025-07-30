-- CreateEnum
CREATE TYPE "public"."MessageStatus" AS ENUM ('PENDING', 'SENT', 'ERROR_SENDING', 'ERROR_CHANNEL_NOT_FOUND');

-- CreateTable
CREATE TABLE "public"."scheduled_messages" (
    "id" BIGSERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel_id" TEXT NOT NULL,
    "message_content" TEXT NOT NULL,
    "schedule_time" TIMESTAMP(3) NOT NULL,
    "status" "public"."MessageStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "scheduled_messages_pkey" PRIMARY KEY ("id")
);
