/**
 * Parse a days search param into an array of day numbers (0=Sun, 1=Mon, ..., 6=Sat).
 * Returns null if no filter is applied (all days).
 */
export function parseDaysParam(
  days: string | undefined
): number[] | null {
  if (!days) return null;
  const parsed = days
    .split(",")
    .map(Number)
    .filter((n) => n >= 0 && n <= 6);
  return parsed.length > 0 ? parsed : null;
}
