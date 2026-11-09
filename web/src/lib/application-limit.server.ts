import { prisma } from "@/lib/prisma";
import { checkAutoApprovalEligibility } from "@/lib/auto-approval";
import {
  MAX_PENDING_APPLICATIONS,
  buildApplicationLimitError,
  type ApplicationLimitError,
  type ApplicationLimitStatus,
} from "@/lib/application-limit";

/**
 * How many applications the volunteer has open: PENDING signups on shifts
 * that haven't started yet. Stale PENDING rows on past shifts are ignored so
 * an application nobody answered can't lock a volunteer out forever.
 * REGULAR_PENDING (generated for regulars) and WAITLISTED are not applications.
 */
export async function countPendingApplications(
  userId: string,
  excludeShiftId?: string
): Promise<number> {
  return prisma.signup.count({
    where: {
      userId,
      status: "PENDING",
      ...(excludeShiftId ? { shiftId: { not: excludeShiftId } } : {}),
      shift: { start: { gt: new Date() } },
    },
  });
}

/**
 * Where the volunteer stands against the cap for a signup to `shiftId`.
 *
 * At the cap, a signup is still allowed when it would be approved instantly:
 * it never joins the waiting pile, and Amy's rule is that confirmed shifts
 * are fine. The eligibility check only runs at the cap, so the common path
 * costs a single count. Callers that have already evaluated auto-approval
 * pass the answer as `knownEligible` to save a second evaluation.
 */
export async function getApplicationLimitStatus(
  userId: string,
  shiftId: string,
  knownEligible?: boolean
): Promise<ApplicationLimitStatus> {
  const pending = await countPendingApplications(userId, shiftId);
  let reached = false;
  if (pending >= MAX_PENDING_APPLICATIONS) {
    const eligible =
      knownEligible ??
      (await checkAutoApprovalEligibility(userId, shiftId)).eligible;
    reached = !eligible;
  }
  return { limit: MAX_PENDING_APPLICATIONS, pending, reached };
}

/**
 * Guard for the signup routes (web and mobile share it so the rule cannot
 * drift). Returns the 400 payload when the application must be refused, or
 * null when it may proceed.
 *
 * Only call this for a signup that would be created as PENDING. Joining a
 * waitlist is not an application and is never capped.
 */
export async function validateApplicationLimit(
  userId: string,
  shiftId: string
): Promise<ApplicationLimitError | null> {
  const status = await getApplicationLimitStatus(userId, shiftId);
  return status.reached ? buildApplicationLimitError(status) : null;
}
