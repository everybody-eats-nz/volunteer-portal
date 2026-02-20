/**
 * Returns the effective confirmed count including placeholder (walk-in) volunteers.
 * Clamps placeholderCount to >= 0 for safety.
 */
export function getEffectiveConfirmedCount(
  confirmedSignups: number,
  placeholderCount: number
): number {
  return confirmedSignups + Math.max(0, placeholderCount);
}
