-- Auto-approval redesign.
--
-- 1. Rules gain a kind (APPROVE / BLOCK), per-volunteer label overrides, and
--    an archive flag so rules with decision history are never hard-deleted.
-- 2. `stopOnMatch` is dropped. It read as "stop once this rule matches" but the
--    evaluator returned early on a match, so the flag only ever fired on a
--    *non*-match - silently making the highest-priority applicable rule the
--    only rule that could ever run. BLOCK rules express the real intent.
-- 3. AutoApprovalDecision records every evaluation, approved or not, with the
--    per-criterion trace that answers "why?".

-- CreateEnum
CREATE TYPE "AutoApprovalRuleKind" AS ENUM ('APPROVE', 'BLOCK');

-- CreateEnum
CREATE TYPE "AutoApprovalOutcome" AS ENUM ('APPROVED', 'HELD', 'BLOCKED', 'ERROR');

-- AlterTable
ALTER TABLE "AutoAcceptRule"
  ADD COLUMN "kind" "AutoApprovalRuleKind" NOT NULL DEFAULT 'APPROVE',
  ADD COLUMN "requiredLabelIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "maxVolunteerAge" INTEGER,
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  DROP COLUMN "stopOnMatch";

-- CreateIndex
CREATE INDEX "AutoAcceptRule_archivedAt_idx" ON "AutoAcceptRule"("archivedAt");

-- CreateTable
CREATE TABLE "AutoApprovalDecision" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signupId" TEXT,
    "userId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "outcome" "AutoApprovalOutcome" NOT NULL,
    "ruleId" TEXT,
    "ruleName" TEXT,
    "summary" TEXT NOT NULL,
    "trace" JSONB NOT NULL,
    "stats" JSONB NOT NULL,

    CONSTRAINT "AutoApprovalDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutoApprovalDecision_createdAt_idx" ON "AutoApprovalDecision"("createdAt");
CREATE INDEX "AutoApprovalDecision_outcome_createdAt_idx" ON "AutoApprovalDecision"("outcome", "createdAt");
CREATE INDEX "AutoApprovalDecision_ruleId_createdAt_idx" ON "AutoApprovalDecision"("ruleId", "createdAt");
CREATE INDEX "AutoApprovalDecision_userId_createdAt_idx" ON "AutoApprovalDecision"("userId", "createdAt");
CREATE INDEX "AutoApprovalDecision_shiftId_idx" ON "AutoApprovalDecision"("shiftId");
CREATE INDEX "AutoApprovalDecision_signupId_idx" ON "AutoApprovalDecision"("signupId");

-- AddForeignKey
ALTER TABLE "AutoApprovalDecision" ADD CONSTRAINT "AutoApprovalDecision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutoApprovalDecision" ADD CONSTRAINT "AutoApprovalDecision_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutoApprovalDecision" ADD CONSTRAINT "AutoApprovalDecision_signupId_fkey" FOREIGN KEY ("signupId") REFERENCES "Signup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AutoApprovalDecision" ADD CONSTRAINT "AutoApprovalDecision_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutoAcceptRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
