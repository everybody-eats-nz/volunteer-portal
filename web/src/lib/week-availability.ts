export interface DayOfWeek {
  key: string;
  short: string;
  full: string;
}

/** Canonical Monday-first week. */
export const DAYS_OF_WEEK: readonly DayOfWeek[] = [
  { key: "monday", short: "Mon", full: "Monday" },
  { key: "tuesday", short: "Tue", full: "Tuesday" },
  { key: "wednesday", short: "Wed", full: "Wednesday" },
  { key: "thursday", short: "Thu", full: "Thursday" },
  { key: "friday", short: "Fri", full: "Friday" },
  { key: "saturday", short: "Sat", full: "Saturday" },
  { key: "sunday", short: "Sun", full: "Sunday" },
] as const;

export interface WeekDay extends DayOfWeek {
  isAvailable: boolean;
}

export interface WeekAvailability {
  /** All seven days, always Monday-first, flagged by availability. */
  days: WeekDay[];
  count: number;
}

/**
 * Maps availability data (in any casing/order) onto the canonical Monday-first
 * week. The result is always seven days in order, so presentation never depends
 * on how the data was stored.
 */
export function getWeekAvailability(
  availableDays: readonly string[] | null | undefined
): WeekAvailability {
  const available = new Set(
    (availableDays ?? []).map((day) => day.toLowerCase().trim())
  );
  const days = DAYS_OF_WEEK.map((day) => ({
    ...day,
    isAvailable: available.has(day.key),
  }));
  return { days, count: days.filter((day) => day.isAvailable).length };
}
