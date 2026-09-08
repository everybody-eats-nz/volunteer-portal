-- When the driver was last nudged that this trip is still open.
--
-- Exceptions themselves stay derived — fix the trip and the entry disappears.
-- This is not one of them: it is a fact about something we did, the way
-- "endedByUserId" is a fact about who closed the trip, and without it every
-- run of the reminder job would nudge the same driver again.
ALTER TABLE "Trip" ADD COLUMN "reminderSentAt" TIMESTAMP(3);

-- The reminder job asks for open trips only.
CREATE INDEX "Trip_status_reminderSentAt_idx" ON "Trip"("status", "reminderSentAt");
