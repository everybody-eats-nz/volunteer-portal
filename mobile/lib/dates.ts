import { format } from "date-fns";
import { tz } from "@date-fns/tz";

const nzTz = tz("Pacific/Auckland");

/**
 * Format a date in New Zealand timezone.
 * All dates from the API are UTC — this ensures they display
 * as NZ local time regardless of the device's timezone setting.
 */
export function formatNZT(
  date: Date | string | number,
  formatStr: string
): string {
  const dateObj = typeof date === "string" || typeof date === "number"
    ? new Date(date)
    : date;
  const nzDate = nzTz(dateObj);
  return format(nzDate, formatStr, { in: nzTz });
}

/**
 * Format a *date-only* value — a calendar day with no meaningful time-of-day,
 * such as a daily menu's service date.
 *
 * Such values arrive as either "YYYY-MM-DD" or a midnight-UTC ISO string
 * ("2026-05-18T00:00:00.000Z"). They represent a calendar day, NOT an instant,
 * so they must never be timezone-converted: converting midnight UTC to a
 * timezone behind UTC rolls it back to the previous day (e.g. "Monday 18th"
 * becomes "Sunday 17th"). On Android this is unavoidable with formatNZT —
 * Hermes ships no IANA timezone data, so `@date-fns/tz` silently falls back to
 * device-local time and the conversion happens regardless of intent.
 *
 * Instead we read the calendar fields straight off the value and format them
 * with no timezone math, so the result is identical on every device and OS.
 */
export function formatNZDateOnly(
  value: string,
  formatStr: string
): string {
  const ymd = value.slice(0, 10); // "YYYY-MM-DD" from either input shape
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return "";
  // Local-time Date built from the calendar fields. format() reads only the
  // local Y/M/D, so it returns the intended day on every timezone.
  return format(new Date(y, m - 1, d), formatStr);
}
