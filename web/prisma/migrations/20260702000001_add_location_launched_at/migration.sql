-- Add Location.launchedAt: the first time a location had published shifts.
-- Stays NULL for locations created ahead of their shifts, so they remain
-- hidden from volunteer-facing location lists until shifts exist.
ALTER TABLE "Location" ADD COLUMN "launchedAt" TIMESTAMP(3);

-- Backfill: any location that already has shifts launched when it was created.
-- Locations without shifts keep NULL and get stamped when their first shifts appear.
UPDATE "Location" l
SET "launchedAt" = l."createdAt"
WHERE EXISTS (
  SELECT 1 FROM "Shift" s WHERE s."location" = l."name"
);
