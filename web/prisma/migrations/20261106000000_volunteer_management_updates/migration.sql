-- Volunteer management updates (Nov 2026): label notes and watchers, a
-- per-shift auto-approval switch, shift application response tracking,
-- admin-added waitlist confirmation, and the no-show email.

-- CreateEnum
CREATE TYPE "SignupResponse" AS ENUM ('APPROVED', 'AUTO_APPROVED', 'WAITLISTED', 'DECLINED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'LABEL_ASSIGNED';

-- AlterTable
ALTER TABLE "CustomLabel" ADD COLUMN     "requiresNote" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "autoApprovalEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Signup" ADD COLUMN     "appliedAt" TIMESTAMP(3),
ADD COLUMN     "noShowEmailSentAt" TIMESTAMP(3),
ADD COLUMN     "noShowMarkedAt" TIMESTAMP(3),
ADD COLUMN     "respondedAt" TIMESTAMP(3),
ADD COLUMN     "respondedById" TEXT,
ADD COLUMN     "response" "SignupResponse",
ADD COLUMN     "waitlistAddedByAdminAt" TIMESTAMP(3),
ADD COLUMN     "waitlistConfirmedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "UserCustomLabel" ADD COLUMN     "assignedById" TEXT,
ADD COLUMN     "note" TEXT;

-- CreateTable
CREATE TABLE "CustomLabelWatcher" (
    "id" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomLabelWatcher_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomLabelWatcher_userId_idx" ON "CustomLabelWatcher"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomLabelWatcher_labelId_userId_key" ON "CustomLabelWatcher"("labelId", "userId");

-- CreateIndex
CREATE INDEX "Signup_appliedAt_idx" ON "Signup"("appliedAt");

-- CreateIndex
CREATE INDEX "Signup_noShowMarkedAt_noShowEmailSentAt_idx" ON "Signup"("noShowMarkedAt", "noShowEmailSentAt");

-- AddForeignKey
ALTER TABLE "Signup" ADD CONSTRAINT "Signup_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCustomLabel" ADD CONSTRAINT "UserCustomLabel_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomLabelWatcher" ADD CONSTRAINT "CustomLabelWatcher_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "CustomLabel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomLabelWatcher" ADD CONSTRAINT "CustomLabelWatcher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: which existing signups were applications. Every volunteer signup
-- that went through the auto-approval evaluator left a decision row, and
-- anything still PENDING is waiting on a decision now.
UPDATE "Signup" s SET "appliedAt" = s."createdAt"
WHERE s."appliedAt" IS NULL
  AND (
    s."status" = 'PENDING'
    OR EXISTS (SELECT 1 FROM "AutoApprovalDecision" d WHERE d."signupId" = s."id")
  );

-- Backfill: auto-approvals already record when they happened. Human
-- decisions before this release were never timestamped, so they stay null
-- and the report shows them as "no timing recorded".
UPDATE "Signup" s SET
  "response" = 'AUTO_APPROVED',
  "respondedAt" = a."approvedAt"
FROM "AutoApproval" a
WHERE a."signupId" = s."id" AND s."response" IS NULL;
