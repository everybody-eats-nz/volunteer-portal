-- DropForeignKey
ALTER TABLE "GroupInvitation" DROP CONSTRAINT IF EXISTS "GroupInvitation_groupBookingId_fkey";
ALTER TABLE "GroupInvitation" DROP CONSTRAINT IF EXISTS "GroupInvitation_invitedById_fkey";
ALTER TABLE "GroupBooking" DROP CONSTRAINT IF EXISTS "GroupBooking_shiftId_fkey";
ALTER TABLE "GroupBooking" DROP CONSTRAINT IF EXISTS "GroupBooking_leaderId_fkey";
ALTER TABLE "Signup" DROP CONSTRAINT IF EXISTS "Signup_groupBookingId_fkey";

-- AlterTable: Remove groupBookingId from Signup
ALTER TABLE "Signup" DROP COLUMN IF EXISTS "groupBookingId";

-- DropTable
DROP TABLE IF EXISTS "GroupInvitation";
DROP TABLE IF EXISTS "GroupBooking";

-- DropEnum
DROP TYPE IF EXISTS "GroupBookingStatus";
DROP TYPE IF EXISTS "GroupInvitationStatus";

-- Remove GROUP_INVITATION from NotificationType enum
-- (Cannot remove enum values in PostgreSQL, but we can leave it — unused values are harmless)
