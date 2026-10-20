-- Volunteers now choose at signup whether a pending signup should go on the
-- waitlist if the shift fills before it is approved. Existing signups keep the
-- old behaviour (waitlisted), so the column defaults to true.
ALTER TABLE "Signup" ADD COLUMN "waitlistIfFull" BOOLEAN NOT NULL DEFAULT true;
