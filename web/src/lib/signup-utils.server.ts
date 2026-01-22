/**
 * Server-only utility functions for signup operations
 * This file uses Prisma and should only be imported in server components/API routes
 */

import { prisma } from "@/lib/prisma";

/**
 * Auto-cancels other pending/waitlisted signups for the same user on the same day
 * when a shift is confirmed. Does NOT send notifications.
 *
 * @param userId - The user whose other signups should be canceled
 * @param confirmedShiftId - The shift that was just confirmed (excluded from cancellation)
 * @param confirmedShiftStart - The start time of the confirmed shift (used for same-day check)
 * @returns The number of signups that were auto-canceled
 */
export async function autoCancelOtherPendingSignupsForDay(
  userId: string,
  confirmedShiftId: string,
  confirmedShiftStart: Date
): Promise<number> {
  // Get the NZ calendar date of the confirmed shift
  const confirmedNZDate = new Intl.DateTimeFormat("en-NZ", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Pacific/Auckland",
  }).format(confirmedShiftStart);

  // Find all other pending/waitlisted signups for this user
  const otherSignups = await prisma.signup.findMany({
    where: {
      userId,
      status: {
        in: ["PENDING", "WAITLISTED", "REGULAR_PENDING"],
      },
      shiftId: {
        not: confirmedShiftId,
      },
    },
    include: {
      shift: {
        include: {
          shiftType: true,
        },
      },
    },
  });

  // Filter to only signups on the same NZ calendar day
  const signupsToCancel = otherSignups.filter((signup) => {
    const signupNZDate = new Intl.DateTimeFormat("en-NZ", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Pacific/Auckland",
    }).format(signup.shift.start);
    return signupNZDate === confirmedNZDate;
  });

  if (signupsToCancel.length === 0) {
    return 0;
  }

  // Cancel all matching signups silently (no notifications)
  const signupIds = signupsToCancel.map((s) => s.id);

  await prisma.signup.updateMany({
    where: {
      id: { in: signupIds },
    },
    data: {
      status: "CANCELED",
      canceledAt: new Date(),
      previousStatus: "PENDING", // Note: updateMany doesn't support per-record values
      cancellationReason: "Auto-canceled: Another shift was confirmed for this day",
    },
  });

  console.log(
    `Auto-canceled ${signupsToCancel.length} pending signup(s) for user ${userId} on ${confirmedNZDate}`
  );

  return signupsToCancel.length;
}
