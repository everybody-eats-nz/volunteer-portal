-- CreateEnum
CREATE TYPE "ArchiveReason" AS ENUM ('INACTIVE_12_MONTHS', 'NEVER_ACTIVATED', 'NEVER_MIGRATED', 'MANUAL');

-- CreateEnum
CREATE TYPE "ArchiveEventType" AS ENUM ('ARCHIVED', 'UNARCHIVED', 'WARNING_SENT', 'FIRST_SHIFT_NUDGE_SENT', 'EXTENDED');

-- CreateEnum
CREATE TYPE "ArchiveTriggerSource" AS ENUM ('MANUAL', 'CRON', 'SELF_EXTENSION', 'SELF_REACTIVATION');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archiveReason" "ArchiveReason",
ADD COLUMN     "archivedBy" TEXT,
ADD COLUMN     "archiveWarningSentAt" TIMESTAMP(3),
ADD COLUMN     "firstShiftNudgeSentAt" TIMESTAMP(3),
ADD COLUMN     "archiveExtendedUntil" TIMESTAMP(3),
ADD COLUMN     "archiveExtensionToken" TEXT,
ADD COLUMN     "archiveExtensionTokenExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_archiveExtensionToken_key" ON "User"("archiveExtensionToken");

-- CreateIndex
CREATE INDEX "User_archivedAt_idx" ON "User"("archivedAt");

-- CreateTable
CREATE TABLE "ArchiveLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" "ArchiveEventType" NOT NULL,
    "reason" "ArchiveReason",
    "triggerSource" "ArchiveTriggerSource" NOT NULL,
    "actorId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchiveLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArchiveLog_userId_createdAt_idx" ON "ArchiveLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ArchiveLog_createdAt_idx" ON "ArchiveLog"("createdAt");

-- CreateIndex
CREATE INDEX "ArchiveLog_eventType_createdAt_idx" ON "ArchiveLog"("eventType", "createdAt");

-- AddForeignKey
ALTER TABLE "ArchiveLog" ADD CONSTRAINT "ArchiveLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchiveLog" ADD CONSTRAINT "ArchiveLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
