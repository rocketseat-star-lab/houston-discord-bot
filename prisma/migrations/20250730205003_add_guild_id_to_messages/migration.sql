/*
  Warnings:

  - Added the required column `guild_id` to the `scheduled_messages` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."scheduled_messages" ADD COLUMN     "guild_id" TEXT NOT NULL;
