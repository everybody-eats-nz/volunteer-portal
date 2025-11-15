/**
 * Centralized date and time format constants
 * Used throughout the application for consistent date/time formatting
 */

// Date formats
export const DATE_FORMATS = {
  /** Full date with day name: "Monday, January 15, 2024" */
  FULL_DATE_WITH_DAY: "EEEE, MMMM d, yyyy",

  /** Short date with day: "Mon, 15 Jan 2024" */
  SHORT_DATE_WITH_DAY: "EEE, dd MMM yyyy",

  /** Short date: "Jan 15, 2024" */
  SHORT_DATE: "MMM d, yyyy",

  /** Date with day: "EEE, MMM d, yyyy" (e.g., "Mon, Jan 15, 2024") */
  DATE_WITH_DAY: "EEE, MMM d, yyyy",

  /** Month and day only: "Jan 15" */
  MONTH_DAY: "MMM d",

  /** Full month year: "January 2024" */
  MONTH_YEAR: "MMMM yyyy",

  /** Day of week: "Monday" */
  DAY_OF_WEEK: "EEEE",

  /** Short day of week: "Mon" */
  SHORT_DAY: "EEE",

  /** ISO date: "2024-01-15" */
  ISO_DATE: "yyyy-MM-dd",

  /** Date with day: "Monday, January 15, 2024" */
  FULL_DATE: "PPPP",
} as const;

// Time formats
export const TIME_FORMATS = {
  /** 12-hour time: "5:30 PM" */
  TIME_12H: "h:mm a",

  /** 24-hour time: "17:30" */
  TIME_24H: "HH:mm",

  /** Time without space: "5:30PM" */
  TIME_COMPACT: "h:mma",

  /** Time with seconds: "5:30:00 PM" */
  TIME_WITH_SECONDS: "h:mm:ss a",
} as const;

// Combined date and time formats
export const DATETIME_FORMATS = {
  /** Full datetime: "Monday, January 15, 2024 at 5:30 PM" */
  FULL_DATETIME: "PPp",

  /** Short datetime: "Jan 15, 2024, 5:30 PM" */
  SHORT_DATETIME: "MMM d, yyyy, h:mm a",

  /** Date and time: "Jan 15, 5:30 PM" */
  DATE_TIME: "MMM d, h:mm a",

  /** Short date with time: "Mon, Jan 15, 2024, 5:30 PM" */
  SHORT_DATE_TIME: "EEE, MMM d, yyyy, h:mm a",
} as const;

// Calendar formats (for iCal, Google Calendar, etc.)
export const CALENDAR_FORMATS = {
  /** Calendar export format: "20240115T173000" */
  ICAL_DATETIME: "yyyyMMdd'T'HHmmss",
} as const;

// Type exports for TypeScript autocomplete
export type DateFormat = typeof DATE_FORMATS[keyof typeof DATE_FORMATS];
export type TimeFormat = typeof TIME_FORMATS[keyof typeof TIME_FORMATS];
export type DateTimeFormat = typeof DATETIME_FORMATS[keyof typeof DATETIME_FORMATS];
export type CalendarFormat = typeof CALENDAR_FORMATS[keyof typeof CALENDAR_FORMATS];
