-- CreateEnum
CREATE TYPE "public"."CriteriaLogic" AS ENUM ('AND', 'OR');

-- CreateTable
CREATE TABLE "public"."AutoAcceptRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "global" BOOLEAN NOT NULL DEFAULT false,
    "shiftTypeId" TEXT,
    "minVolunteerGrade" "public"."VolunteerGrade",
    "minCompletedShifts" INTEGER,
    "minAttendanceRate" DOUBLE PRECISION,
    "minAccountAgeDays" INTEGER,
    "maxDaysInAdvance" INTEGER,
    "requireShiftTypeExperience" BOOLEAN NOT NULL DEFAULT false,
    "criteriaLogic" "public"."CriteriaLogic" NOT NULL DEFAULT 'AND',
    "stopOnMatch" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "AutoAcceptRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AutoApproval" (
    "id" TEXT NOT NULL,
    "signupId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "overridden" BOOLEAN NOT NULL DEFAULT false,
    "overriddenBy" TEXT,
    "overriddenAt" TIMESTAMP(3),
    "overrideReason" TEXT,

    CONSTRAINT "AutoApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutoAcceptRule_enabled_priority_idx" ON "public"."AutoAcceptRule"("enabled", "priority");

-- CreateIndex
CREATE INDEX "AutoAcceptRule_shiftTypeId_enabled_idx" ON "public"."AutoAcceptRule"("shiftTypeId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "AutoApproval_signupId_key" ON "public"."AutoApproval"("signupId");

-- CreateIndex
CREATE INDEX "AutoApproval_ruleId_idx" ON "public"."AutoApproval"("ruleId");

-- CreateIndex
CREATE INDEX "AutoApproval_overridden_idx" ON "public"."AutoApproval"("overridden");

-- AddForeignKey
ALTER TABLE "public"."AutoAcceptRule" ADD CONSTRAINT "AutoAcceptRule_shiftTypeId_fkey" FOREIGN KEY ("shiftTypeId") REFERENCES "public"."ShiftType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AutoAcceptRule" ADD CONSTRAINT "AutoAcceptRule_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AutoApproval" ADD CONSTRAINT "AutoApproval_signupId_fkey" FOREIGN KEY ("signupId") REFERENCES "public"."Signup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AutoApproval" ADD CONSTRAINT "AutoApproval_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "public"."AutoAcceptRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AutoApproval" ADD CONSTRAINT "AutoApproval_overriddenBy_fkey" FOREIGN KEY ("overriddenBy") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
