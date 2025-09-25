-- CreateEnum
CREATE TYPE "public"."VolunteerGrade" AS ENUM ('GREEN', 'YELLOW', 'PINK');

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "volunteerGrade" "public"."VolunteerGrade" NOT NULL DEFAULT 'GREEN';
