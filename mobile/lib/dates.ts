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
