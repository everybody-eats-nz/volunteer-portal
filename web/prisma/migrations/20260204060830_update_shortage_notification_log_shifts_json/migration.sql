/*
  Warnings:

  - You are about to drop the column `shiftDate` on the `ShortageNotificationLog` table. All the data in the column will be lost.
  - You are about to drop the column `shiftId` on the `ShortageNotificationLog` table. All the data in the column will be lost.
  - You are about to drop the column `shiftLocation` on the `ShortageNotificationLog` table. All the data in the column will be lost.
  - You are about to drop the column `shiftTypeName` on the `ShortageNotificationLog` table. All the data in the column will be lost.
  - Added the required column `shifts` to the `ShortageNotificationLog` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "ShortageNotificationLog_shiftId_idx";

-- AlterTable
ALTER TABLE "ShortageNotificationLog" DROP COLUMN "shiftDate",
DROP COLUMN "shiftId",
DROP COLUMN "shiftLocation",
DROP COLUMN "shiftTypeName",
ADD COLUMN     "shifts" JSONB NOT NULL;
