import { formatInNZT, toNZT } from "@/lib/timezone";

/**
 * Pure Day/Evening period helpers, kept free of Prisma so client components can
 * import them. `concurrent-shifts.ts` re-exports these for server callers.
 */

/** Hour cutoff (NZ time) — shifts starting before this are "Day", at or after are "Evening" */
export const DAY_EVENING_CUTOFF_HOUR = 16;

/**
 * Whether a shift falls in the day period (before 4pm NZ time).
 *
 * Note the boundary is 4pm, not midday: a 3pm shift is a Day shift. Never
 * describe the result as "AM"/"PM" in user-facing copy.
 */
export function isDayShift(shiftStart: Date): boolean {
  const nzTime = toNZT(shiftStart);
  const hour = nzTime.getHours();
  return hour < DAY_EVENING_CUTOFF_HOUR;
}

/**
 * Returns a display label for the shift period: "Day" or "Evening".
 */
export function getShiftPeriodLabel(shiftStart: Date): string {
  return isDayShift(shiftStart) ? "Day" : "Evening";
}

/**
 * Helper to get shift date in NZ timezone (YYYY-MM-DD format)
 */
export function getShiftDate(shiftStart: Date): string {
  return formatInNZT(shiftStart, "yyyy-MM-dd");
}
