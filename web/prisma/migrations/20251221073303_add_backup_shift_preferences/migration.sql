-- AlterTable
ALTER TABLE "Signup" ADD COLUMN     "backupForShiftIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
