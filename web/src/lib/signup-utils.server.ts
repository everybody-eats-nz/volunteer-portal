/**
 * Server-only utility functions for signup operations
 * This file uses Prisma and should only be imported in server components/API routes
 */

import { prisma } from "@/lib/prisma";
import { isAMShift, getShiftDate } from "@/lib/concurrent-shifts";

/**
 * Auto-cancels other pending/waitlisted signups for the same user on the same day
 * and same period (AM/PM) when a shift is confirmed. Does NOT send notifications.
 *
 * Uses the same AM/PM threshold as concurrent shifts: before 4pm is AM, 4pm+ is PM.
 *
 * @param userId - The user whose other signups should be canceled
 * @param confirmedShiftId - The shift that was just confirmed (excluded from cancellation)
 * @param confirmedShiftStart - The start time of the confirmed shift (used for same-day and period check)
 * @returns The number of signups that were auto-canceled
 */
export async function autoCancelOtherPendingSignupsForDay(
  userId: string,
  confirmedShiftId: string,
  confirmedShiftStart: Date
): Promise<number> {
  // Get the NZ calendar date and period (AM/PM) of the confirmed shift
  const confirmedNZDate = getShiftDate(confirmedShiftStart);
  const confirmedIsAM = isAMShift(confirmedShiftStart);
  const confirmedPeriod = confirmedIsAM ? "AM" : "PM";

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

  // Filter to only signups on the same NZ calendar day AND same period (AM/PM)
  const signupsToCancel = otherSignups.filter((signup) => {
    const signupNZDate = getShiftDate(signup.shift.start);
    const signupIsAM = isAMShift(signup.shift.start);

    // Only cancel if both the date AND period match
    return signupNZDate === confirmedNZDate && signupIsAM === confirmedIsAM;
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
      cancellationReason: `Auto-canceled: Another ${confirmedPeriod} shift was confirmed for this day`,
    },
  });

  console.log(
    `Auto-canceled ${signupsToCancel.length} pending ${confirmedPeriod} signup(s) for user ${userId} on ${confirmedNZDate}`
  );

  return signupsToCancel.length;
}
