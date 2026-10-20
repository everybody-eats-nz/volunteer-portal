import { z } from "zod";

/**
 * Day themes: a short free-text label for one service day at one location
 * ("Christmas Lunch", "Pasta Night", "Private event"), shown to volunteers
 * beside the date on the shift calendar and the day's shift list.
 *
 * A day can instead be marked closed (public holidays, a staff night out).
 * Volunteers then see "Closed" with the theme text as the reason, which is
 * optional.
 *
 * Days are handled as "yyyy-MM-dd" keys for the NZ calendar day throughout -
 * the same keys the shift calendar buckets shifts by - and stored in a SQL DATE
 * column, so no timezone conversion ever touches them.
 */

/** Matches the VarChar(80) column. Long enough for a short sentence. */
export const SHIFT_DAY_THEME_MAX_LENGTH = 80;

/** What an admin set for one day at one location. */
export interface ShiftDayTheme {
  /** The theme, or on a closed day the reason. Empty on a closed day with no reason. */
  theme: string;
  closed: boolean;
}

/** Day themes keyed by location name, then by "yyyy-MM-dd" day key. */
export type ShiftDayThemeMap = Record<string, Record<string, ShiftDayTheme>>;

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
 * Body for PUT /api/admin/shift-day-themes. An empty theme on an open day
 * clears it; a closed day keeps its row with or without a reason.
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
  closed: z.boolean({ error: "Closed must be true or false" }).default(false),
});

export type ShiftDayThemeInput = z.infer<typeof shiftDayThemeSchema>;

/** Group theme rows into a {@link ShiftDayThemeMap}. */
export function toShiftDayThemeMap(
  rows: Array<{ date: Date; location: string; theme: string; closed: boolean }>
): ShiftDayThemeMap {
  const map: ShiftDayThemeMap = {};
  for (const row of rows) {
    (map[row.location] ??= {})[dbDateToDayKey(row.date)] = {
      theme: row.theme,
      closed: row.closed,
    };
  }
  return map;
}

/**
 * The day as one line of text: the theme, or "Closed" with the reason after
 * it. For places that can only show a single string, like a tooltip or the
 * plain-text map older app builds read.
 */
export function dayThemeLabel({ theme, closed }: ShiftDayTheme): string {
  if (!closed) return theme;
  return theme ? `Closed - ${theme}` : "Closed";
}

/**
 * The map as single strings per day ({@link dayThemeLabel}), the shape
 * mobile app builds from before closed days read as `dayThemes`.
 */
export function toDayThemeLabelMap(
  map: ShiftDayThemeMap
): Record<string, Record<string, string>> {
  return Object.fromEntries(
    Object.entries(map).map(([location, byDay]) => [
      location,
      Object.fromEntries(
        Object.entries(byDay).map(([day, entry]) => [day, dayThemeLabel(entry)])
      ),
    ])
  );
}
