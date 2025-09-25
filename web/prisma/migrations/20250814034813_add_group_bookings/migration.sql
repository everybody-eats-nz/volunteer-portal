-- CreateEnum
CREATE TYPE "public"."GroupBookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'WAITLISTED', 'CANCELED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "public"."GroupInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELED');

-- AlterTable
ALTER TABLE "public"."Signup" ADD COLUMN     "groupBookingId" TEXT;

-- CreateTable
CREATE TABLE "public"."GroupBooking" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "shiftId" TEXT NOT NULL,
    "leaderId" TEXT NOT NULL,
    "maxMembers" INTEGER NOT NULL DEFAULT 10,
    "status" "public"."GroupBookingStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GroupInvitation" (
    "id" TEXT NOT NULL,
    "groupBookingId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "status" "public"."GroupInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupBooking_shiftId_leaderId_key" ON "public"."GroupBooking"("shiftId", "leaderId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupInvitation_token_key" ON "public"."GroupInvitation"("token");

-- CreateIndex
CREATE UNIQUE INDEX "GroupInvitation_groupBookingId_email_key" ON "public"."GroupInvitation"("groupBookingId", "email");

-- AddForeignKey
ALTER TABLE "public"."Signup" ADD CONSTRAINT "Signup_groupBookingId_fkey" FOREIGN KEY ("groupBookingId") REFERENCES "public"."GroupBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GroupBooking" ADD CONSTRAINT "GroupBooking_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "public"."Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GroupBooking" ADD CONSTRAINT "GroupBooking_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GroupInvitation" ADD CONSTRAINT "GroupInvitation_groupBookingId_fkey" FOREIGN KEY ("groupBookingId") REFERENCES "public"."GroupBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GroupInvitation" ADD CONSTRAINT "GroupInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
