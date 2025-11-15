-- AlterEnum
ALTER TYPE "public"."NotificationType" ADD VALUE 'UNDERAGE_USER_REGISTERED';

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "allowFriendSuggestions" BOOLEAN NOT NULL DEFAULT true;
