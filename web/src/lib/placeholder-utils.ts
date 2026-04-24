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
