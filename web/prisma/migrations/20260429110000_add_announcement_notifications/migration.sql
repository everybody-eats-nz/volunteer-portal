-- AlterEnum: add ANNOUNCEMENT notification type
ALTER TYPE "NotificationType" ADD VALUE 'ANNOUNCEMENT';

-- AlterTable: add optional in-app notification fields to Announcement
ALTER TABLE "Announcement"
  ADD COLUMN "sendNotification" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "notificationSentAt" TIMESTAMP(3);
