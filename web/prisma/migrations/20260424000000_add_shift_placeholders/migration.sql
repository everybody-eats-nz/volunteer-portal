-- Add ShiftPlaceholder table for named walk-in / unregistered volunteers
CREATE TABLE "ShiftPlaceholder" (
  "id" TEXT NOT NULL,
  "shiftId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShiftPlaceholder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShiftPlaceholder_shiftId_idx" ON "ShiftPlaceholder"("shiftId");

ALTER TABLE "ShiftPlaceholder"
  ADD CONSTRAINT "ShiftPlaceholder_shiftId_fkey"
  FOREIGN KEY ("shiftId") REFERENCES "Shift"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing placeholderCount values into named placeholder rows.
-- Each existing count becomes N rows with a generic "Walk-in volunteer" name
-- so admins can edit/rename them later.
INSERT INTO "ShiftPlaceholder" ("id", "shiftId", "name", "notes", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  s."id",
  'Walk-in volunteer',
  NULL,
  NOW(),
  NOW()
FROM "Shift" s
CROSS JOIN LATERAL generate_series(1, s."placeholderCount") AS g
WHERE s."placeholderCount" > 0;

-- Drop the legacy count column now that rows are migrated.
ALTER TABLE "Shift" DROP COLUMN "placeholderCount";
