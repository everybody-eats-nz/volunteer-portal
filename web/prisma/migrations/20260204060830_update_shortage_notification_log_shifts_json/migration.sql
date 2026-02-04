/*
  Warnings:

  - You are about to drop the column `shiftDate` on the `ShortageNotificationLog` table. All the data in the column will be lost.
  - You are about to drop the column `shiftId` on the `ShortageNotificationLog` table. All the data in the column will be lost.
  - You are about to drop the column `shiftLocation` on the `ShortageNotificationLog` table. All the data in the column will be lost.
  - You are about to drop the column `shiftTypeName` on the `ShortageNotificationLog` table. All the data in the column will be lost.
  - Added the required column `shifts` to the `ShortageNotificationLog` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX IF EXISTS "ShortageNotificationLog_shiftId_idx";

-- AlterTable: Add shifts column as nullable first
ALTER TABLE "ShortageNotificationLog" ADD COLUMN "shifts" JSONB;

-- Migrate existing data: Convert old single-shift columns to JSON array format
UPDATE "ShortageNotificationLog"
SET "shifts" = jsonb_build_array(
  jsonb_build_object(
    'shiftId', "shiftId",
    'shiftTypeName', "shiftTypeName",
    'shiftDate', "shiftDate",
    'shiftLocation', "shiftLocation"
  )
)
WHERE "shifts" IS NULL;

-- Make the column NOT NULL now that all rows have data
ALTER TABLE "ShortageNotificationLog" ALTER COLUMN "shifts" SET NOT NULL;

-- Drop the old columns
ALTER TABLE "ShortageNotificationLog" DROP COLUMN "shiftDate",
DROP COLUMN "shiftId",
DROP COLUMN "shiftLocation",
DROP COLUMN "shiftTypeName";
