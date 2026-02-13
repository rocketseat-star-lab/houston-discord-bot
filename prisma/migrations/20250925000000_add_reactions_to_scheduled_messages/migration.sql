-- AlterTable
ALTER TABLE "houston_bot_scheduled_messages" ADD COLUMN     "reactions" TEXT[] DEFAULT ARRAY[]::TEXT[];
