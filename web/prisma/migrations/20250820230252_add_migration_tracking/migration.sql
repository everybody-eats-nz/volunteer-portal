/*
  Warnings:

  - A unique constraint covering the columns `[migrationInvitationToken]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "isMigrated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "migrationInvitationSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "migrationInvitationSentAt" TIMESTAMP(3),
ADD COLUMN     "migrationInvitationToken" TEXT,
ADD COLUMN     "migrationTokenExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_migrationInvitationToken_key" ON "public"."User"("migrationInvitationToken");
