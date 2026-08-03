export interface VenueManager {
  id: string;
  name: string;
  initials: string;
  /** Manager is assigned but has alert notifications switched off. */
  muted: boolean;
}

export interface Venue {
  id: string;
  name: string;
  address: string;
  defaultMealsServed: number;
  targetPerNight: number | null;
  isActive: boolean;
  isPopup: boolean;
  /** Active venues without upcoming shifts are invisible to volunteers. */
  upcomingShifts: number;
  /** ISO string of the next upcoming shift start, if any. */
  nextServiceAt: string | null;
  managers: VenueManager[];
}

/**
 * The locations API returns raw Prisma rows (Decimal targetPerNight arrives as
 * a string, no derived fields). Merge one into an existing Venue so derived
 * data (shift counts, managers) survives an edit round-trip.
 */
export function mergeApiLocation(
  current: Venue,
  raw: {
    name: string;
    address: string;
    defaultMealsServed: number;
    targetPerNight: string | number | null;
    isActive: boolean;
    isPopup: boolean;
  }
): Venue {
  return {
    ...current,
    name: raw.name,
    address: raw.address,
    defaultMealsServed: raw.defaultMealsServed,
    targetPerNight:
      raw.targetPerNight === null ? null : Number(raw.targetPerNight),
    isActive: raw.isActive,
    isPopup: raw.isPopup,
  };
}

export function formatKoha(value: number | null): string {
  if (value === null) return "—";
  const hasCents = Math.round(value * 100) % 100 !== 0;
  return `$${value.toLocaleString("en-NZ", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}
