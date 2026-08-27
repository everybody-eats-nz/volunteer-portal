import { formatInNZT, toNZT } from "@/lib/timezone";

/**
 * Pure shift-time helpers, kept free of Prisma so client components can import
 * them. `concurrent-shifts.ts` re-exports these for server callers.
 *
 * The Day/Evening split is a *presentation* grouping — it drives section
 * headings, calendar labels and "who else is on this session" lists. It is no
 * longer the signup rule: whether two signups clash is decided by
 * `shiftsOverlap`, which compares actual times.
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

/** One shift's occupied time span. */
export type ShiftInterval = { start: Date; end: Date };

/**
 * Whether two shifts occupy overlapping time.
 *
 * Half-open comparison, so a shift ending exactly when another starts does not
 * clash — back-to-back signups are allowed. Both bounds are absolute instants,
 * so this needs no timezone or DST handling.
 */
export function shiftsOverlap(a: ShiftInterval, b: ShiftInterval): boolean {
  return a.start < b.end && b.start < a.end;
}
