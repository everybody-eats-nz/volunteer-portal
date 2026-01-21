-- CreateEnum
CREATE TYPE "SurveyTriggerType" AS ENUM ('SHIFTS_COMPLETED', 'HOURS_VOLUNTEERED', 'FIRST_SHIFT', 'MANUAL');

-- CreateEnum
CREATE TYPE "SurveyAssignmentStatus" AS ENUM ('PENDING', 'DISMISSED', 'COMPLETED', 'EXPIRED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SURVEY_ASSIGNED';

-- CreateTable
CREATE TABLE "Survey" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "questions" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "triggerType" "SurveyTriggerType" NOT NULL,
    "triggerValue" INTEGER NOT NULL,

    CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyAssignment" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SurveyAssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),

    CONSTRAINT "SurveyAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyResponse" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Survey_isActive_triggerType_idx" ON "Survey"("isActive", "triggerType");

-- CreateIndex
CREATE INDEX "SurveyAssignment_userId_status_idx" ON "SurveyAssignment"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyAssignment_surveyId_userId_key" ON "SurveyAssignment"("surveyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyToken_token_key" ON "SurveyToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyToken_assignmentId_key" ON "SurveyToken"("assignmentId");

-- CreateIndex
CREATE INDEX "SurveyToken_token_idx" ON "SurveyToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyResponse_assignmentId_key" ON "SurveyResponse"("assignmentId");

-- AddForeignKey
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyAssignment" ADD CONSTRAINT "SurveyAssignment_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyAssignment" ADD CONSTRAINT "SurveyAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyToken" ADD CONSTRAINT "SurveyToken_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "SurveyAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "SurveyAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
