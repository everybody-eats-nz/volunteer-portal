-- AlterTable
-- Make expiresAt optional (allow NULL) for survey tokens
-- This allows tokens to never expire
-- Existing tokens with expiry dates will keep them, new tokens will have NULL (never expire)
ALTER TABLE "SurveyToken" ALTER COLUMN "expiresAt" DROP NOT NULL;
