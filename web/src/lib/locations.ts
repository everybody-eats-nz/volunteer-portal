// Centralized location configuration for Everybody Eats Volunteer Portal

import { prisma } from "@/lib/prisma";
import type { LocationOption as ShiftLocationOption } from "@/lib/location-utils";

// A location is identified by its display name. This is a plain string alias
// (rather than a union derived from a one-time database snapshot) so that
// locations created at runtime are always valid without a rebuild or restart.
export type Location = string;

export type LocationOption = Location;

// Default location
export const DEFAULT_LOCATION: Location = "Wellington";

/**
 * Fetch active location names fresh from the database.
 *
 * This reads current data on every call. Use it anywhere newly created
 * locations must appear immediately (shift-creation forms, admin filters,
 * validation, etc.) rather than only after the server process restarts.
 */
export async function getActiveLocationNames(): Promise<string[]> {
  const rows = await prisma.location.findMany({
    where: { isActive: true },
    select: { name: true },
    orderBy: { name: "asc" },
  });
  return rows.map((loc) => loc.name);
}

/**
 * Fetch the map of location name -> street address, fresh from the database.
 *
 * Includes every location (active or not) so addresses still resolve for
 * shifts at venues that have since been deactivated. Reads current data on
 * every call, so newly created locations resolve immediately.
 */
export async function getLocationAddresses(): Promise<Record<string, string>> {
  const rows = await prisma.location.findMany({
    select: { name: true, address: true },
    orderBy: { name: "asc" },
  });
  return rows.reduce<Record<string, string>>((acc, loc) => {
    acc[loc.name] = loc.address;
    return acc;
  }, {});
}

// Helper function to generate Google Maps URL for an address
export function getGoogleMapsUrl(address: string): string {
  const encodedAddress = encodeURIComponent(address);
  return `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
}

/**
 * Build the list of locations offered in registration/profile forms.
 *
 * The list is derived from existing shifts (so ad-hoc venues that only exist
 * as free-form shift strings still appear), but any location that has been
 * explicitly disabled in the Location table is excluded. Each option is
 * annotated with `isPopup` so callers can keep pop-up venues out of the
 * "default location" choice.
 */
export async function getShiftLocationOptions(): Promise<
  ShiftLocationOption[]
> {
  const [shifts, locationRows] = await Promise.all([
    prisma.shift.findMany({
      select: { location: true },
      where: { location: { not: null } },
    }),
    prisma.location.findMany({
      select: { name: true, isActive: true, isPopup: true },
    }),
  ]);

  const disabledNames = new Set(
    locationRows.filter((l) => !l.isActive).map((l) => l.name)
  );
  const popupNames = new Set(
    locationRows.filter((l) => l.isPopup).map((l) => l.name)
  );

  const uniqueLocations = [
    ...new Set(
      shifts
        .map((shift) => shift.location)
        .filter((location): location is string => location !== null)
        .map((location) => location.replace(/\s+/g, " ").trim())
        .filter((location) => location.length > 0)
    ),
  ]
    .filter((name) => !disabledNames.has(name))
    .sort();

  return uniqueLocations.map((name) => ({
    value: name,
    label: name,
    isPopup: popupNames.has(name),
  }));
}
