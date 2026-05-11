import type { SignupStatus } from "@/generated/client";

/**
 * Returns the effective confirmed count including unregistered volunteers.
 * Unregistered volunteers don't have a Signup row — they live in the
 * ShiftPlaceholder table and count toward capacity. Clamps unregisteredCount
 * to >= 0 for safety.
 */
export function getEffectiveConfirmedCount(
  confirmedSignups: number,
  unregisteredCount: number
): number {
  return confirmedSignups + Math.max(0, unregisteredCount);
}

/**
 * Counts CONFIRMED signups on a shift and adds its unregistered volunteer
 * count. Use this when you've loaded raw (unfiltered) signups along with
 * `_count.placeholders` — e.g. the capacity check on the signup endpoints.
 *
 * Requires the shift to be queried with `include: { signups: true, _count:
 * { select: { placeholders: true } } }` (or equivalent).
 */
export function getShiftConfirmedCount(shift: {
  signups: Array<{ status: string }>;
  _count: { placeholders: number };
}): number {
  const confirmedSignups = shift.signups.filter(
    (s) => s.status === "CONFIRMED"
  ).length;
  return getEffectiveConfirmedCount(confirmedSignups, shift._count.placeholders);
}

/**
 * Canonical Prisma `_count` select for shift capacity. Counts registered
 * signups (optionally filtered by status) plus unregistered placeholders.
 *
 * Use this in any Prisma query that needs to know how many spots a shift
 * has filled, so unregistered volunteers can't be silently dropped from
 * the count:
 *
 *   prisma.shift.findMany({
 *     include: { _count: shiftCapacityCountSelect(["CONFIRMED"]) },
 *   })
 *
 * Pair with `getShiftEffectiveCount` to read the result.
 */
export function shiftCapacityCountSelect(statuses?: readonly SignupStatus[]) {
  return {
    select: {
      signups: statuses
        ? { where: { status: { in: [...statuses] } } }
        : true,
      placeholders: true,
    },
  } as const;
}

/**
 * Returns the effective volunteer count from a shift loaded with the
 * standard `_count` shape: registered signups (already status-filtered by
 * the query) plus unregistered placeholders. Pair with
 * `shiftCapacityCountSelect` on the query side.
 */
export function getShiftEffectiveCount(shift: {
  _count: { signups: number; placeholders: number };
}): number {
  return shift._count.signups + shift._count.placeholders;
}
