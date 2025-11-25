// Centralized location configuration for Everybody Eats Volunteer Portal

import { prisma } from "@/lib/prisma";

const dbLocations = await prisma.location.findMany({
  where: { isActive: true },
  select: { name: true, address: true },
  orderBy: { name: "asc" },
});
export const LOCATIONS = dbLocations.map((loc) => loc.name);

export type Location = (typeof LOCATIONS)[number];

export type LocationOption = Location;

// Restaurant addresses for Google Maps
export const LOCATION_ADDRESSES: Record<Location, string> = dbLocations.reduce(
  (acc, loc) => {
    acc[loc.name] = loc.address;
    return acc;
  },
  {} as Record<Location, string>
);

// Default location
export const DEFAULT_LOCATION: Location = "Wellington";

// Helper function to generate Google Maps URL for an address
export function getGoogleMapsUrl(address: string): string {
  const encodedAddress = encodeURIComponent(address);
  return `https://www.google.com/maps/search/?api=1&query=Everybody+Eats+${encodedAddress}`;
}

// Helper function to get Google Maps URL for a location
export function getLocationMapsUrl(location: Location): string {
  return getGoogleMapsUrl(LOCATION_ADDRESSES[location]);
}
