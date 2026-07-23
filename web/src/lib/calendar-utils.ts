import { formatInNZT } from "./timezone";
import { getBaseUrl } from "./utils";
import { getShiftDescription } from "./shift-description";

/**
 * Calendar utilities for generating calendar links for shifts
 */

/**
 * Map of location name -> street address. Passed in by callers (from
 * `getLocationAddresses()`) rather than read from a module-level snapshot, so
 * newly created locations resolve immediately. Unknown locations fall back to
 * their raw name.
 */
export type LocationAddressMap = Record<string, string>;

interface ShiftCalendarData {
  id: string;
  start: Date;
  end: Date;
  location: string | null;
  notes?: string | null;
  shiftType: {
    name: string;
    description: string | null;
  };
}

/**
 * Escape special characters for ICS format: backslashes, commas, and semicolons (RFC 5545)
 * Newlines should appear as literal '\n' (already produced elsewhere); escape backslashes EXCEPT those in '\n'.
 */
function escapeICSText(text: string): string {
  // Escape backslash first, then comma and semicolon
  return text
    .replace(/\\/g, "\\\\")      // Escape backslashes
    .replace(/,/g, "\\,")        // Escape commas
    .replace(/;/g, "\\;");       // Escape semicolons
}

/**
 * Get full address for a location including venue name
 */
function getFullAddress(
  location: string | null,
  addresses: LocationAddressMap,
  escapeForICS: boolean = false
): string {
  if (!location || location === "TBD") {
    return "TBD";
  }
  const address = addresses[location] || location;
  const fullAddress = `Everybody Eats, ${address}`;
  return escapeForICS ? escapeICSText(fullAddress) : fullAddress;
}

/**
 * Build calendar description with shift details link
 * @param shift - Shift data
 * @param format - 'ics' for ICS files (escapes commas/semicolons), 'url' for URL-encoded formats (uses newlines)
 */
function buildCalendarDescription(
  shift: ShiftCalendarData,
  addresses: LocationAddressMap,
  format: "ics" | "url" = "url"
): string {
  const shiftDetailsLink = `${getBaseUrl()}/shifts/${shift.id}`;
  const fullAddress = getFullAddress(shift.location, addresses, false); // Don't escape yet
  const shiftDescription =
    getShiftDescription(shift.notes, shift.shiftType.description) || "";

  if (format === "ics") {
    // For ICS: use separators that display consistently across all calendar apps
    const parts = [shiftDescription, `Location: ${fullAddress}`, `View shift details: ${shiftDetailsLink}`];
    const description = parts.filter(p => p).join(" | ");
    return escapeICSText(description);
  } else {
    // For URL formats: use actual newlines
    return `${shiftDescription}\nLocation: ${fullAddress}\n\nView shift details: ${shiftDetailsLink}`;
  }
}

export interface CalendarUrls {
  google: string;
  outlook: string;
  ics: string;
}

export interface CalendarData {
  google: string;
  outlook: string;
  icsContent: string;
}

/**
 * Generate calendar URLs for Google Calendar, Outlook, and ICS file download
 * Times are formatted in NZ timezone (Pacific/Auckland)
 */
export function generateCalendarUrls(
  shift: ShiftCalendarData,
  addresses: LocationAddressMap = {}
): CalendarUrls {
  // Format dates in NZ timezone for calendar exports
  const startDate = formatInNZT(shift.start, "yyyyMMdd'T'HHmmss");
  const endDate = formatInNZT(shift.end, "yyyyMMdd'T'HHmmss");

  // Outlook requires ISO 8601 format with separators
  const outlookStartDate = formatInNZT(shift.start, "yyyy-MM-dd'T'HH:mm:ss");
  const outlookEndDate = formatInNZT(shift.end, "yyyy-MM-dd'T'HH:mm:ss");

  const title = encodeURIComponent(`Everybody Eats - ${shift.shiftType.name}`);
  const description = encodeURIComponent(
    buildCalendarDescription(shift, addresses)
  );
  const location = encodeURIComponent(getFullAddress(shift.location, addresses));

  // Generate ICS content using the shared function
  const icsContent = generateICSContent(shift, addresses);
  const icsDataUrl = `data:text/calendar;charset=utf8,${encodeURIComponent(
    icsContent
  )}`;

  return {
    google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}&details=${description}&location=${location}&ctz=Pacific/Auckland`,
    outlook: `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${outlookStartDate}&enddt=${outlookEndDate}&body=${description}&location=${location}`,
    ics: icsDataUrl,
  };
}

/**
 * Generate raw ICS file content (not a data URL) for email attachments
 * Times are formatted in NZ timezone (Pacific/Auckland)
 */
export function generateICSContent(
  shift: ShiftCalendarData,
  addresses: LocationAddressMap = {}
): string {
  const startDate = formatInNZT(shift.start, "yyyyMMdd'T'HHmmss");
  const endDate = formatInNZT(shift.end, "yyyyMMdd'T'HHmmss");
  const title = `Everybody Eats - ${shift.shiftType.name}`;
  const description = buildCalendarDescription(shift, addresses, "ics");
  const location = getFullAddress(shift.location, addresses, true); // Escape for ICS format

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Volunteer Portal//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-TIMEZONE:Pacific/Auckland
BEGIN:VTIMEZONE
TZID:Pacific/Auckland
BEGIN:STANDARD
DTSTART:20240407T030000
TZOFFSETFROM:+1300
TZOFFSETTO:+1200
RRULE:FREQ=YEARLY;BYMONTH=4;BYDAY=1SU
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:20240929T020000
TZOFFSETFROM:+1200
TZOFFSETTO:+1300
RRULE:FREQ=YEARLY;BYMONTH=9;BYDAY=-1SU
END:DAYLIGHT
END:VTIMEZONE
BEGIN:VEVENT
UID:${shift.id}@volunteerportal.com
DTSTART;TZID=Pacific/Auckland:${startDate}
DTEND;TZID=Pacific/Auckland:${endDate}
SUMMARY:${title}
DESCRIPTION:${description}
LOCATION:${location}
END:VEVENT
END:VCALENDAR`;
}

/**
 * Generate calendar data with ICS content for email attachments
 * Times are formatted in NZ timezone (Pacific/Auckland)
 */
export function generateCalendarData(
  shift: ShiftCalendarData,
  addresses: LocationAddressMap = {}
): CalendarData {
  const startDate = formatInNZT(shift.start, "yyyyMMdd'T'HHmmss");
  const endDate = formatInNZT(shift.end, "yyyyMMdd'T'HHmmss");

  // Outlook requires ISO 8601 format with separators
  const outlookStartDate = formatInNZT(shift.start, "yyyy-MM-dd'T'HH:mm:ss");
  const outlookEndDate = formatInNZT(shift.end, "yyyy-MM-dd'T'HH:mm:ss");

  const title = encodeURIComponent(`Everybody Eats - ${shift.shiftType.name}`);
  const description = encodeURIComponent(
    buildCalendarDescription(shift, addresses)
  );
  const location = encodeURIComponent(getFullAddress(shift.location, addresses));

  return {
    google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}&details=${description}&location=${location}&ctz=Pacific/Auckland`,
    outlook: `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${outlookStartDate}&enddt=${outlookEndDate}&body=${description}&location=${location}`,
    icsContent: generateICSContent(shift, addresses),
  };
}

/**
 * Generate a Google Calendar link for email templates
 */
export function generateGoogleCalendarLink(
  shift: ShiftCalendarData,
  addresses: LocationAddressMap = {}
): string {
  return generateCalendarUrls(shift, addresses).google;
}

/**
 * Generate a Google Maps link for a location
 */
export function generateGoogleMapsLink(
  location: string | null,
  addresses: LocationAddressMap = {}
): string {
  if (!location || location === "TBD") {
    return "";
  }

  const address = addresses[location] || location;
  return `https://maps.google.com/maps?q=${encodeURIComponent(
    `Everybody Eats ${address}`
  )}`;
}
