-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "parentalConsentApprovedBy" TEXT,
ADD COLUMN     "parentalConsentReceived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parentalConsentReceivedAt" TIMESTAMP(3),
ADD COLUMN     "requiresParentalConsent" BOOLEAN NOT NULL DEFAULT false;
