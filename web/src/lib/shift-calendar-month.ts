import { format, isSameMonth } from "date-fns";

/**
 * Month the shifts browse calendar should open on, as a "yyyy-MM" string.
 *
 * Normally that's the current month. But shifts only run on some weekdays, so
 * late in a month there can be none left in it - browsing on a Friday the 31st
 * when the next shift is the following Sunday is enough. Opening on the current
 * month then strands the volunteer on an empty grid behind a "next month"
 * button, so fall through to the month of the next shift instead.
 *
 * Returns a year-month string rather than a Date because the result crosses
 * into a client component: a start-of-month instant would resolve to the
 * previous month for viewers behind NZ time and desync hydration from SSR.
 *
 * @param upcomingShiftStarts Start times of the shifts the calendar will show.
 *   Only upcoming shifts, already filtered to the selected location.
 */
export function resolveInitialCalendarMonth(
  upcomingShiftStarts: Date[],
  now: Date
): string {
  const earliest = upcomingShiftStarts.reduce<Date | null>(
    (min, start) => (min === null || start < min ? start : min),
    null
  );

  if (earliest && !isSameMonth(earliest, now)) {
    return format(earliest, "yyyy-MM");
  }

  return format(now, "yyyy-MM");
}
