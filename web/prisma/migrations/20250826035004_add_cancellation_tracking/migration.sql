-- Add fields to track cancellation details
ALTER TABLE "Signup" ADD COLUMN "canceledAt" TIMESTAMP(3);
ALTER TABLE "Signup" ADD COLUMN "previousStatus" TEXT;
ALTER TABLE "Signup" ADD COLUMN "cancellationReason" TEXT;

-- Create an index for finding canceled signups efficiently
CREATE INDEX "Signup_status_canceledAt_idx" ON "Signup"("status", "canceledAt");
CREATE INDEX "Signup_userId_canceledAt_idx" ON "Signup"("userId", "canceledAt");