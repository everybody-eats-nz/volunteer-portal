-- Add explicit default restaurant location to User.
ALTER TABLE "User" ADD COLUMN "defaultLocation" TEXT;

-- Backfill from existing availableLocations (stored as JSON array string).
-- Pick the first entry that isn't "Special Event Venue" — matches existing
-- auto-filter heuristic in shift browsing.
UPDATE "User"
SET "defaultLocation" = picked.loc
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
) AS picked
WHERE "User".id = picked.id;
