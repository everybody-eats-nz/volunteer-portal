-- AlterTable: track when a user last authenticated on the mobile app.
-- Used by the admin UI to gate the 1:1 "Message" action — push tokens alone
-- are too strict because they require OS notification permission, so a user
-- can have the app installed but no PushToken row.
ALTER TABLE "User"
  ADD COLUMN "lastMobileLoginAt" TIMESTAMP(3);

-- Backfill from existing push tokens so users we already know are on mobile
-- don't have to re-open the app before the admin "Message" button reappears.
-- The most-recent PushToken row's lastUsedAt (or createdAt as fallback) is a
-- reasonable proxy for their previous mobile activity.
UPDATE "User"
SET "lastMobileLoginAt" = sub.last_seen
FROM (
  SELECT
    "userId",
    MAX(COALESCE("lastUsedAt", "createdAt")) AS last_seen
  FROM "PushToken"
  GROUP BY "userId"
) AS sub
WHERE "User".id = sub."userId";
