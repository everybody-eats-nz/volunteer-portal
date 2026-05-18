// Client-safe location helpers.
//
// IMPORTANT: this module must NOT import `@/lib/prisma` (or anything that
// pulls it in). It is consumed by client components, so keep it pure.

/** A selectable location option presented in registration/profile forms. */
export interface LocationOption {
  value: string;
  label: string;
  /** Pop-up / temporary venue — can be an available location, never a default. */
  isPopup: boolean;
}

/**
 * Location names that are never eligible to be a user's default location,
 * regardless of the Location table. Kept as a string fallback for venues that
 * exist only as free-form shift strings (no Location row to carry `isPopup`).
 */
export const NON_DEFAULT_LOCATION_NAMES: readonly string[] = [
  "Special Event Venue",
];

/**
 * Given the locations a user can volunteer at, return the subset that may be
 * chosen as their default location. Excludes pop-up venues and the hardcoded
 * non-default fallback names.
 */
export function getDefaultLocationCandidates(
  availableLocations: string[],
  options: Pick<LocationOption, "value" | "isPopup">[]
): string[] {
  const popupNames = new Set(
    options.filter((o) => o.isPopup).map((o) => o.value)
  );
  return availableLocations.filter(
    (loc) => !NON_DEFAULT_LOCATION_NAMES.includes(loc) && !popupNames.has(loc)
  );
}
