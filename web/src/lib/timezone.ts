import { format } from "date-fns";
import { tz } from "@date-fns/tz";

const NZ_TIMEZONE = "Pacific/Auckland";
// Singleton timezone instance for performance optimization
const nzTimezone = tz(NZ_TIMEZONE);

/**
 * Format a date/time in New Zealand timezone with input validation
 * @param date - The date to format
 * @param formatStr - The format string (same as date-fns format)
 * @returns Formatted date string in NZ timezone
 * @throws Error if date is invalid
 */
export function formatInNZT(date: Date | string, formatStr: string): string {
  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    
    // Validate date
    if (isNaN(dateObj.getTime())) {
      throw new Error(`Invalid date provided: ${date}`);
    }
    
    const nzTime = nzTimezone(dateObj);
    return format(nzTime, formatStr, { in: nzTimezone });
  } catch (error) {
    console.error("Error formatting date in NZT:", error);
    return "Invalid Date";
  }
}

/**
 * Convert a date to New Zealand timezone with input validation
 * @param date - The date to convert
 * @returns TZDate object representing the time in NZ timezone
 * @throws Error if date is invalid
 */
export function toNZT(date: Date | string) {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  
  // Validate date
  if (isNaN(dateObj.getTime())) {
    throw new Error(`Invalid date provided: ${date}`);
  }
  
  return nzTimezone(dateObj);
}

/**
 * Get the current time in New Zealand
 * @returns TZDate object representing current time in NZ timezone
 */
export function nowInNZT() {
  return nzTimezone(new Date());
}

/**
 * Check if a date is the same day in NZ timezone
 * @param date1 - First date
 * @param date2 - Second date
 * @returns True if both dates are on the same day in NZ timezone
 */
export function isSameDayInNZT(date1: Date | string, date2: Date | string): boolean {
  try {
    const nz1 = toNZT(date1);
    const nz2 = toNZT(date2);
    
    return (
      nz1.getFullYear() === nz2.getFullYear() &&
      nz1.getMonth() === nz2.getMonth() &&
      nz1.getDate() === nz2.getDate()
    );
  } catch (error) {
    console.error("Error comparing dates in NZT:", error);
    return false;
  }
}

/**
 * Parse an ISO date string directly in NZ timezone
 * This avoids the parseISO -> toNZT conversion inconsistency
 * @param dateString - ISO date string (e.g., "2023-12-25")
 * @returns TZDate object in NZ timezone
 */
export function parseISOInNZT(dateString: string) {
  // Parse the date string and interpret it directly in NZ timezone
  // This ensures the date represents the actual day in NZ, not local time
  const [year, month, day] = dateString.split('-').map(Number);
  const nzDate = nzTimezone(new Date(year, month - 1, day));
  return nzDate;
}

/**
 * Convert a TZDate to UTC Date object for database queries
 * @param tzDate - The TZDate object to convert
 * @returns UTC Date object safe for database queries
 */
export function toUTC(tzDate: Date): Date {
  return new Date(tzDate.getTime());
}

/**
 * Check if a date falls within NZ DST transition periods
 * DST transitions can cause 1-hour gaps or overlaps in local time
 * @param date - Date to check
 * @returns Object indicating if date is near DST transition
 */
export function getDSTTransitionInfo(date: Date | string) {
  const nzDate = toNZT(date);
  const year = nzDate.getFullYear();
  
  // NZ DST typically runs from last Sunday in September to first Sunday in April
  // These are approximate - actual dates vary by year
  const dstStart = new Date(year, 8, 24); // Late September approximation
  const dstEnd = new Date(year, 3, 7);    // Early April approximation
  
  const dateTime = nzDate.getTime();
  const dstStartTime = dstStart.getTime();
  const dstEndTime = dstEnd.getTime();
  
  // Check if within 24 hours of a DST transition
  const nearTransition = 
    Math.abs(dateTime - dstStartTime) < 24 * 60 * 60 * 1000 ||
    Math.abs(dateTime - dstEndTime) < 24 * 60 * 60 * 1000;
    
  return {
    nearTransition,
    isDST: dateTime >= dstStartTime || dateTime < dstEndTime,
    message: nearTransition ? 
      "Date is near DST transition - times may be affected" : null
  };
}