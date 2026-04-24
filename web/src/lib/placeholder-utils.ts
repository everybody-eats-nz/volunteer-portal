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
