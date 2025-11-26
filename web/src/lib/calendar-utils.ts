import { formatInNZT } from "./timezone";
import { LOCATION_ADDRESSES } from "./locations";
import { getBaseUrl } from "./utils";

/**
 * Calendar utilities for generating calendar links for shifts
 */

interface ShiftCalendarData {
  id: string;
  start: Date;
  end: Date;
  location: string | null;
  shiftType: {
    name: string;
    description: string | null;
  };
}

/**
 * Escape special characters for ICS format (commas and semicolons only)
 * Note: We don't escape backslashes here because \n sequences are intentional
 */
function escapeICSText(text: string): string {
  return text
    .replace(/,/g, "\\,") // Escape commas
    .replace(/;/g, "\\;"); // Escape semicolons
}

/**
 * Get full address for a location including venue name
 */
function getFullAddress(
  location: string | null,
  escapeForICS: boolean = false
): string {
  if (!location || location === "TBD") {
    return "TBD";
  }
  const address =
    LOCATION_ADDRESSES[location as keyof typeof LOCATION_ADDRESSES] || location;
  const fullAddress = `Everybody Eats, ${address}`;
  return escapeForICS ? escapeICSText(fullAddress) : fullAddress;
}

/**
 * Build calendar description with shift details link
 * @param shift - Shift data
 * @param format - 'ics' for ICS files (uses \\n and escapes special chars), 'url' for URL-encoded formats (uses \n)
 */
function buildCalendarDescription(
  shift: ShiftCalendarData,
  format: "ics" | "url" = "url"
): string {
  const shiftDetailsLink = `${getBaseUrl()}/shifts/${shift.id}`;
  const fullAddress = getFullAddress(shift.location, false); // Don't escape yet
  const separator = format === "ics" ? "\\n" : "\n";
  const shiftDescription = shift.shiftType.description || "";
  const description = `${shiftDescription}${separator}Location: ${fullAddress}${separator}${separator}View shift details: ${shiftDetailsLink}`;

  // Escape special characters for ICS format (commas, semicolons, backslashes)
  return format === "ics" ? escapeICSText(description) : description;
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
export function generateCalendarUrls(shift: ShiftCalendarData): CalendarUrls {
  // Format dates in NZ timezone for calendar exports
  const startDate = formatInNZT(shift.start, "yyyyMMdd'T'HHmmss");
  const endDate = formatInNZT(shift.end, "yyyyMMdd'T'HHmmss");
  const title = encodeURIComponent(`Everybody Eats - ${shift.shiftType.name}`);
  const description = encodeURIComponent(buildCalendarDescription(shift));
  const location = encodeURIComponent(getFullAddress(shift.location));

  // Generate ICS content using the shared function
  const icsContent = generateICSContent(shift);
  const icsDataUrl = `data:text/calendar;charset=utf8,${encodeURIComponent(
    icsContent
  )}`;

  return {
    google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}&details=${description}&location=${location}&ctz=Pacific/Auckland`,
    outlook: `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${startDate}&enddt=${endDate}&body=${description}&location=${location}`,
    ics: icsDataUrl,
  };
}

/**
 * Generate raw ICS file content (not a data URL) for email attachments
 * Times are formatted in NZ timezone (Pacific/Auckland)
 */
export function generateICSContent(shift: ShiftCalendarData): string {
  const startDate = formatInNZT(shift.start, "yyyyMMdd'T'HHmmss");
  const endDate = formatInNZT(shift.end, "yyyyMMdd'T'HHmmss");
  const title = `Everybody Eats - ${shift.shiftType.name}`;
  const description = buildCalendarDescription(shift, "ics");
  const location = getFullAddress(shift.location, true); // Escape for ICS format

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
export function generateCalendarData(shift: ShiftCalendarData): CalendarData {
  const startDate = formatInNZT(shift.start, "yyyyMMdd'T'HHmmss");
  const endDate = formatInNZT(shift.end, "yyyyMMdd'T'HHmmss");
  const title = encodeURIComponent(`Everybody Eats - ${shift.shiftType.name}`);
  const description = encodeURIComponent(buildCalendarDescription(shift));
  const location = encodeURIComponent(getFullAddress(shift.location));

  return {
    google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}&details=${description}&location=${location}&ctz=Pacific/Auckland`,
    outlook: `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${startDate}&enddt=${endDate}&body=${description}&location=${location}`,
    icsContent: generateICSContent(shift),
  };
}

/**
 * Generate a Google Calendar link for email templates
 */
export function generateGoogleCalendarLink(shift: ShiftCalendarData): string {
  return generateCalendarUrls(shift).google;
}

/**
 * Generate a Google Maps link for a location
 */
export function generateGoogleMapsLink(location: string | null): string {
  if (!location || location === "TBD") {
    return "";
  }

  const address =
    LOCATION_ADDRESSES[location as keyof typeof LOCATION_ADDRESSES] || location;
  return `https://maps.google.com/maps?q=${encodeURIComponent(
    `Everybody Eats ${address}`
  )}`;
}
