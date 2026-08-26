-- Shifts rostered from a template now remember which template they came from,
-- so a later edit to the template's notes can be carried through to the shifts
-- already on the roster (previously the notes were copied once, at creation).

ALTER TABLE "Shift" ADD COLUMN "templateId" TEXT;

CREATE INDEX "Shift_templateId_start_idx" ON "Shift"("templateId", "start");

ALTER TABLE "Shift"
  ADD CONSTRAINT "Shift_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "ShiftTemplate"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill the link for shifts already on the roster: an upcoming shift belongs
-- to an active template when its role, restaurant, and NZ local start/end times
-- all match. Where several templates match, the oldest one wins so the result is
-- deterministic. Past shifts are left unlinked - nothing propagates to them.
UPDATE "Shift" s
SET "templateId" = m.template_id
FROM (
  SELECT DISTINCT ON (sh.id) sh.id AS shift_id, t.id AS template_id
  FROM "Shift" sh
  JOIN "ShiftTemplate" t
    ON t."isActive"
   AND t."shiftTypeId" = sh."shiftTypeId"
   AND t."location" = sh."location"
   AND to_char(sh."start" AT TIME ZONE 'UTC' AT TIME ZONE 'Pacific/Auckland', 'HH24:MI') = t."startTime"
   AND to_char(sh."end" AT TIME ZONE 'UTC' AT TIME ZONE 'Pacific/Auckland', 'HH24:MI') = t."endTime"
  -- `start` is a naive timestamp holding UTC, so compare it against UTC now.
  WHERE sh."start" >= (now() AT TIME ZONE 'UTC')
  ORDER BY sh.id, t."createdAt", t."id"
) m
WHERE s."id" = m.shift_id;
