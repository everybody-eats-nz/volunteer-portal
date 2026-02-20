-- AlterTable
ALTER TABLE "User" ADD COLUMN     "completedShiftAdjustment" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "completedShiftAdjustmentAt" TIMESTAMP(3),
ADD COLUMN     "completedShiftAdjustmentBy" TEXT,
ADD COLUMN     "completedShiftAdjustmentNote" TEXT;
