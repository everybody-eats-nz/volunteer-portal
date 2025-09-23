import { format } from "date-fns";
import { LOCATION_ADDRESSES } from "./locations";

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

export interface CalendarUrls {
  google: string;
  outlook: string;
  ics: string;
}

/**
 * Generate calendar URLs for Google Calendar, Outlook, and ICS file download
 */
export function generateCalendarUrls(shift: ShiftCalendarData): CalendarUrls {
  const startDate = format(shift.start, "yyyyMMdd'T'HHmmss");
  const endDate = format(shift.end, "yyyyMMdd'T'HHmmss");
  const title = encodeURIComponent(`Volunteer Shift: ${shift.shiftType.name}`);
  const description = encodeURIComponent(
    `${shift.shiftType.description || ""}\nLocation: ${shift.location || "TBD"}`
  );
  const location = encodeURIComponent(shift.location || "");

  return {
    google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}&details=${description}&location=${location}`,
    outlook: `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${startDate}&enddt=${endDate}&body=${description}&location=${location}`,
    ics: `data:text/calendar;charset=utf8,BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Volunteer Portal//EN
BEGIN:VEVENT
UID:${shift.id}@volunteerportal.com
DTSTART:${startDate}
DTEND:${endDate}
SUMMARY:${decodeURIComponent(title)}
DESCRIPTION:${decodeURIComponent(description)}
LOCATION:${decodeURIComponent(location)}
END:VEVENT
END:VCALENDAR`.replace(/\n/g, "%0A"),
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
  
  const address = LOCATION_ADDRESSES[location as keyof typeof LOCATION_ADDRESSES] || location;
  return `https://maps.google.com/maps?q=${encodeURIComponent(`Everybody Eats ${address}`)}`;
}