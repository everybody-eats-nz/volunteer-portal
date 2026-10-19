import { z } from "zod";

/**
 * Day themes: a short free-text label for one service day at one location
 * ("Christmas Lunch", "Pasta Night", "Private event"), shown to volunteers
 * beside the date on the shift calendar and the day's shift list.
 *
 * Days are handled as "yyyy-MM-dd" keys for the NZ calendar day throughout -
 * the same keys the shift calendar buckets shifts by - and stored in a SQL DATE
 * column, so no timezone conversion ever touches them.
 */

/** Matches the VarChar(80) column. Long enough for a short sentence. */
export const SHIFT_DAY_THEME_MAX_LENGTH = 80;

/** Themes keyed by location name, then by "yyyy-MM-dd" day key. */
export type ShiftDayThemeMap = Record<string, Record<string, string>>;

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar day in "yyyy-MM-dd" form (rejects 2026-02-30). */
export function isDayKey(value: string): boolean {
  if (!DAY_KEY_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && dbDateToDayKey(date) === value;
}

/** A "yyyy-MM-dd" key as the Date Prisma writes to a DATE column. */
export function dayKeyToDbDate(dayKey: string): Date {
  return new Date(`${dayKey}T00:00:00.000Z`);
}

/** A DATE column value (read back by Prisma as UTC midnight) as its day key. */
export function dbDateToDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Collapse runs of whitespace (including pasted newlines) into single spaces. */
export function normalizeTheme(theme: string): string {
  return theme.replace(/\s+/g, " ").trim();
}

/**
 * Body for PUT /api/admin/shift-day-themes. An empty theme clears the day.
 */
export const shiftDayThemeSchema = z.object({
  date: z
    .string({ error: "Date is required" })
    .refine(isDayKey, "Date must be a valid YYYY-MM-DD day"),
  location: z
    .string({ error: "Location is required" })
    .trim()
    .min(1, "Location is required"),
  theme: z
    .string({ error: "Theme must be text" })
    .transform(normalizeTheme)
    .pipe(
      z
        .string()
        .max(
          SHIFT_DAY_THEME_MAX_LENGTH,
          `Keep the theme to ${SHIFT_DAY_THEME_MAX_LENGTH} characters or fewer`
        )
    ),
});

export type ShiftDayThemeInput = z.infer<typeof shiftDayThemeSchema>;

/** Group theme rows into a {@link ShiftDayThemeMap}. */
export function toShiftDayThemeMap(
  rows: Array<{ date: Date; location: string; theme: string }>
): ShiftDayThemeMap {
  const map: ShiftDayThemeMap = {};
  for (const row of rows) {
    (map[row.location] ??= {})[dbDateToDayKey(row.date)] = row.theme;
  }
  return map;
}
