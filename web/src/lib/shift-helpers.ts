import { prisma } from "@/lib/prisma";

/**
 * Check if this is the volunteer's first confirmed shift
 * @param userId - The user ID to check
 * @param currentShiftId - The shift ID being confirmed (to exclude from the count)
 * @returns true if this is their first confirmed shift, false otherwise
 */
export async function isFirstConfirmedShift(
  userId: string,
  currentShiftId: string
): Promise<boolean> {
  // Count confirmed signups for this user, excluding the current one
  const confirmedShiftsCount = await prisma.signup.count({
    where: {
      userId,
      status: "CONFIRMED",
      shiftId: {
        not: currentShiftId,
      },
    },
  });

  // If count is 0, this is their first confirmed shift
  return confirmedShiftsCount === 0;
}
