import { differenceInMinutes } from "date-fns";

interface ShiftTimes {
  start: Date;
  end: Date;
}

/**
 * Total hours across shifts, counting partial hours (a 2h30m shift adds 2.5).
 * Minutes are summed before dividing so whole-hour totals stay exact.
 *
 * This is the figure hours achievements and survey triggers compare against,
 * matching `SUM(EXTRACT(EPOCH FROM (end - start))) / 3600` in raw SQL.
 */
export function totalShiftHours(shifts: ShiftTimes[]): number {
  const minutes = shifts.reduce(
    (total, shift) => total + differenceInMinutes(shift.end, shift.start),
    0
  );
  return minutes / 60;
}

/**
 * Hours as a whole number for display. Rounded down so a volunteer never sees
 * "50 hours" while a 50-hour achievement is still locked.
 */
export function displayHours(hours: number): number {
  return Math.floor(hours);
}
