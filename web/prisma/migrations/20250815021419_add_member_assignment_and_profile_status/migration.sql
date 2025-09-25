-- AlterTable
ALTER TABLE "public"."GroupInvitation" ADD COLUMN     "assignedShiftIds" TEXT[];

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "profileCompleted" BOOLEAN NOT NULL DEFAULT false;
