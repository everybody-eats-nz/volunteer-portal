// Centralized location configuration for Everybody Eats Volunteer Portal

export const LOCATIONS = ["Wellington", "Glen Innes", "Onehunga"] as const;

export type Location = (typeof LOCATIONS)[number];

export type LocationOption = Location;

// Location display names and slugs
export const LOCATION_CONFIG = {
  wellington: {
    name: "Wellington",
    value: "Wellington",
    slug: "wellington",
  },
  "glen-innes": {
    name: "Glen Innes", 
    value: "Glen Innes",
    slug: "glen-innes",
  },
  onehunga: {
    name: "Onehunga",
    value: "Onehunga", 
    slug: "onehunga",
  },
} as const;

// Restaurant addresses for Google Maps
export const LOCATION_ADDRESSES: Record<Location, string> = {
  "Wellington": "60 Dixon Street, Te Aro, Wellington, New Zealand",
  "Glen Innes": "133 Line Road, Glen Innes, Auckland, New Zealand", 
  "Onehunga": "306 Onehunga Mall, Auckland, New Zealand"
};

// Helper function to validate location
export function isValidLocation(location: string): location is Location {
  return LOCATIONS.includes(location as Location);
}

// Helper function to get location by slug
export function getLocationBySlug(slug: string): Location | undefined {
  const entry = Object.entries(LOCATION_CONFIG).find(([, config]) => config.slug === slug);
  return entry ? entry[1].value : undefined;
}

// Helper function to get slug by location
export function getSlugByLocation(location: Location): string {
  const entry = Object.entries(LOCATION_CONFIG).find(([, config]) => config.value === location);
  return entry ? entry[1].slug : location.toLowerCase().replace(/\s+/g, '-');
}

// Default location
export const DEFAULT_LOCATION: Location = "Wellington";