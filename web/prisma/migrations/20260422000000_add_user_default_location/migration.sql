-- Add explicit default restaurant location to User.
ALTER TABLE "User" ADD COLUMN "defaultLocation" TEXT;

-- Backfill #1: pick each user's most-booked location from their signup history.
-- Only counts CONFIRMED signups (actual attendance commitment) and ignores
-- "Special Event Venue" since it isn't a regular working location.
-- Ties are broken by recency (max shift end).
UPDATE "User"
SET "defaultLocation" = picked.location
FROM (
  SELECT DISTINCT ON (s."userId")
    s."userId",
    sh.location,
    COUNT(*) AS signup_count,
    MAX(sh."end") AS latest
  FROM "Signup" s
  JOIN "Shift" sh ON sh.id = s."shiftId"
  WHERE s.status = 'CONFIRMED'
    AND sh.location IS NOT NULL
    AND sh.location <> ''
    AND sh.location <> 'Special Event Venue'
  GROUP BY s."userId", sh.location
  ORDER BY s."userId", COUNT(*) DESC, MAX(sh."end") DESC
) AS picked
WHERE "User".id = picked."userId";

-- Backfill #2: for users with no signup history, fall back to the first entry
-- in their availableLocations preference list (excluding "Special Event Venue").
UPDATE "User"
SET "defaultLocation" = fallback.loc
FROM (
  SELECT u.id, loc
  FROM "User" u
  CROSS JOIN LATERAL (
    SELECT value AS loc
    FROM jsonb_array_elements_text(
      CASE
        WHEN u."availableLocations" IS NULL THEN '[]'::jsonb
        WHEN u."availableLocations" ~ '^\s*\[' THEN u."availableLocations"::jsonb
        ELSE '[]'::jsonb
      END
    ) AS value
    WHERE value <> 'Special Event Venue'
    LIMIT 1
  ) AS loc_pick(loc)
) AS fallback
WHERE "User".id = fallback.id
  AND "User"."defaultLocation" IS NULL;
