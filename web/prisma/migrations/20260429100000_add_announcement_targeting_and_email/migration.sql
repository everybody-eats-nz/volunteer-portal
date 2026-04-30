-- AlterTable: extend Announcement targeting and add optional email send
ALTER TABLE "Announcement"
  ADD COLUMN "targetUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "targetShiftIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "sendEmail" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "emailSentAt" TIMESTAMP(3);
