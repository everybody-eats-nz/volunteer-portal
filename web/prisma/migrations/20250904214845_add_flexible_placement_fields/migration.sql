-- AlterTable
ALTER TABLE "public"."Signup" ADD COLUMN     "isFlexiblePlacement" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "originalShiftId" TEXT,
ADD COLUMN     "placedAt" TIMESTAMP(3),
ADD COLUMN     "placementNotes" TEXT;
