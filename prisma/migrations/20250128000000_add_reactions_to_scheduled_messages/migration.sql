-- AlterTable
ALTER TABLE "houstondev"."houston_bot_scheduled_messages" ADD COLUMN     "reactions" TEXT[] DEFAULT ARRAY[]::TEXT[];
