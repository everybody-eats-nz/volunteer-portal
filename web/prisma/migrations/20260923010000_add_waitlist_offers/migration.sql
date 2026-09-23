-- Waitlist offers: when a confirmed place frees up, the next eligible person
-- on the waitlist gets first refusal for a bounded window. Status stays
-- WAITLISTED until they accept, so screens that don't know about offers
-- still read correctly.
ALTER TABLE "Signup" ADD COLUMN "waitlistOfferedAt" TIMESTAMP(3);
ALTER TABLE "Signup" ADD COLUMN "waitlistOfferExpiresAt" TIMESTAMP(3);
ALTER TABLE "Signup" ADD COLUMN "waitlistOfferDeclinedAt" TIMESTAMP(3);

-- The expiry sweep asks one question across every shift at once.
CREATE INDEX "Signup_waitlistOfferExpiresAt_idx" ON "Signup"("waitlistOfferExpiresAt");

ALTER TYPE "NotificationType" ADD VALUE 'SHIFT_WAITLIST_OFFER';
