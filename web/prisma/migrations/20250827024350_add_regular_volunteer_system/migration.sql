-- CreateEnum
CREATE TYPE "public"."Frequency" AS ENUM ('WEEKLY', 'FORTNIGHTLY', 'MONTHLY');

-- AlterEnum
ALTER TYPE "public"."SignupStatus" ADD VALUE 'REGULAR_PENDING';

-- CreateTable
CREATE TABLE "public"."RegularVolunteer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shiftTypeId" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "frequency" "public"."Frequency" NOT NULL DEFAULT 'WEEKLY',
    "availableDays" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPausedByUser" BOOLEAN NOT NULL DEFAULT false,
    "pausedUntil" TIMESTAMP(3),
    "notes" TEXT,
    "volunteerNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastModifiedBy" TEXT,

    CONSTRAINT "RegularVolunteer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RegularSignup" (
    "id" TEXT NOT NULL,
    "regularVolunteerId" TEXT NOT NULL,
    "signupId" TEXT NOT NULL,
    "skipReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegularSignup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegularVolunteer_userId_key" ON "public"."RegularVolunteer"("userId");

-- CreateIndex
CREATE INDEX "RegularVolunteer_userId_isActive_idx" ON "public"."RegularVolunteer"("userId", "isActive");

-- CreateIndex
CREATE INDEX "RegularVolunteer_shiftTypeId_location_isActive_idx" ON "public"."RegularVolunteer"("shiftTypeId", "location", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "RegularSignup_signupId_key" ON "public"."RegularSignup"("signupId");

-- CreateIndex
CREATE INDEX "RegularSignup_regularVolunteerId_idx" ON "public"."RegularSignup"("regularVolunteerId");

-- AddForeignKey
ALTER TABLE "public"."RegularVolunteer" ADD CONSTRAINT "RegularVolunteer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RegularVolunteer" ADD CONSTRAINT "RegularVolunteer_shiftTypeId_fkey" FOREIGN KEY ("shiftTypeId") REFERENCES "public"."ShiftType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RegularSignup" ADD CONSTRAINT "RegularSignup_regularVolunteerId_fkey" FOREIGN KEY ("regularVolunteerId") REFERENCES "public"."RegularVolunteer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RegularSignup" ADD CONSTRAINT "RegularSignup_signupId_fkey" FOREIGN KEY ("signupId") REFERENCES "public"."Signup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
