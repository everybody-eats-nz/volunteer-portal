/**
 * Server-only utility functions for signup operations
 * This file uses Prisma and should only be imported in server components/API routes
 */

import { prisma } from "@/lib/prisma";
import { formatInNZT } from "@/lib/timezone";

/**
 * Auto-cancels the user's other pending/waitlisted signups that clash in time
 * with a shift they've just been confirmed for. Does NOT send notifications.
 *
 * Only genuine double-bookings are cancelled. This used to cancel everything in
 * the same Day/Evening period on the day, which silently dropped signups that
 * did not actually clash.
 *
 * @param userId - The user whose other signups should be canceled
 * @param confirmedShiftId - The shift that was just confirmed (excluded from cancellation)
 * @param confirmedShiftStart - Start of the confirmed shift
 * @param confirmedShiftEnd - End of the confirmed shift
 * @returns The number of signups that were auto-canceled
 */
export async function autoCancelOverlappingPendingSignups(
  userId: string,
  confirmedShiftId: string,
  confirmedShiftStart: Date,
  confirmedShiftEnd: Date
): Promise<number> {
  const signupsToCancel = await prisma.signup.findMany({
    where: {
      userId,
      status: { in: ["PENDING", "WAITLISTED", "REGULAR_PENDING"] },
      shiftId: { not: confirmedShiftId },
      // Half-open, matching `shiftsOverlap`: back-to-back shifts are kept.
      shift: {
        start: { lt: confirmedShiftEnd },
        end: { gt: confirmedShiftStart },
      },
    },
    select: { id: true },
  });

  if (signupsToCancel.length === 0) {
    return 0;
  }

  const confirmedTime = `${formatInNZT(confirmedShiftStart, "h:mm a")} to ${formatInNZT(
    confirmedShiftEnd,
    "h:mm a"
  )}`;

  await prisma.signup.updateMany({
    where: { id: { in: signupsToCancel.map((s) => s.id) } },
    data: {
      status: "CANCELED",
      canceledAt: new Date(),
      previousStatus: "PENDING", // Note: updateMany doesn't support per-record values
      cancellationReason: `Auto-canceled: clashes with a confirmed shift, ${confirmedTime} on ${formatInNZT(
        confirmedShiftStart,
        "EEEE d MMMM"
      )}`,
    },
  });

  console.log(
    `Auto-canceled ${signupsToCancel.length} overlapping signup(s) for user ${userId} at ${confirmedShiftStart.toISOString()}`
  );

  return signupsToCancel.length;
}
