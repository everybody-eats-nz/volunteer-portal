-- Follow-up backfill for users the original defaultLocation migration missed.
-- The previous migration's fallback only parsed availableLocations when it was
-- a JSON array. Legacy rows also store it as a plain string ("Onehunga") or a
-- comma-separated list ("Wellington,Special event venue"). For each user with
-- a null defaultLocation, split availableLocations on commas and pick the
-- first entry that matches an active Location. Rows that can't be resolved
-- (bad data like "Glen,Innes" or empty "[]") stay NULL.

UPDATE "User"
SET "defaultLocation" = picked.loc
FROM (
  SELECT DISTINCT ON (u.id) u.id, loc.name AS loc
  FROM "User" u
  CROSS JOIN LATERAL unnest(string_to_array(u."availableLocations", ',')) WITH ORDINALITY AS entry(val, ord)
  JOIN "Location" loc
    ON lower(TRIM(loc.name)) = lower(TRIM(entry.val))
   AND loc."isActive" = true
  WHERE u."defaultLocation" IS NULL
    AND u."availableLocations" IS NOT NULL
    AND u."availableLocations" <> ''
  ORDER BY u.id, entry.ord
) picked
WHERE "User".id = picked.id;
