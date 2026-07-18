import { safeParseLocations } from "@/lib/parse-availability";

/**
 * All restaurant locations a volunteer is associated with: their default
 * location plus every entry in their `availableLocations` list (stored as a
 * JSON-stringified array, with legacy plain-text values in old rows).
 *
 * Location-targeted notifications and announcements must use this rather than
 * `defaultLocation` alone — a volunteer available at several restaurants would
 * otherwise only ever hear about their default one.
 */
export function getUserLocations(user: {
  defaultLocation: string | null;
  availableLocations: string | null;
}): string[] {
  const locations = new Set<string>(
    safeParseLocations(user.availableLocations)
  );
  if (user.defaultLocation) {
    locations.add(user.defaultLocation);
  }
  return [...locations];
}

/**
 * True when any of the user's locations (default or available) is in
 * `targetLocations`. An empty target list means "all locations".
 */
export function userMatchesTargetLocations(
  user: {
    defaultLocation: string | null;
    availableLocations: string | null;
  },
  targetLocations: string[]
): boolean {
  if (targetLocations.length === 0) return true;
  const userLocations = getUserLocations(user);
  return targetLocations.some((loc) => userLocations.includes(loc));
}
