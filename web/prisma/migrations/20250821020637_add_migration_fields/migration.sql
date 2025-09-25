-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "migrationInvitationCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "migrationLastSentAt" TIMESTAMP(3);
