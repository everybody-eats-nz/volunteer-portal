export interface ManagerUser {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  role: string;
}

export interface Location {
  value: string;
  label: string;
}

export interface RestaurantManager {
  id: string;
  userId: string;
  locations: string[];
  receiveNotifications: boolean;
  createdAt: string;
  updatedAt: string;
  user: ManagerUser;
}

export type CoverageStatus = "active" | "muted" | "gap";

export interface LocationCoverage {
  location: string;
  status: CoverageStatus;
  /** Managers assigned to this location and actively receiving alerts. */
  activeRecipients: RestaurantManager[];
  /** Managers assigned to this location but with notifications switched off. */
  mutedRecipients: RestaurantManager[];
}

export function getUserDisplayName(user: ManagerUser): string {
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  return user.name || user.email;
}

export function getInitials(user: ManagerUser): string {
  if (user.firstName || user.lastName) {
    return `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase();
  }
  const source = user.name || user.email;
  return source.slice(0, 2).toUpperCase();
}

/**
 * Build per-location coverage. A location is "active" when at least one assigned
 * manager is receiving email alerts, "muted" when managers are assigned but none
 * are receiving, and a "gap" when no manager is assigned at all — the critical
 * operational failure where a cancelled shift reaches nobody.
 */
export function computeCoverage(
  locations: Location[],
  managers: RestaurantManager[]
): LocationCoverage[] {
  return locations.map(({ value: location }) => {
    const assigned = managers.filter((m) => m.locations.includes(location));
    const activeRecipients = assigned.filter((m) => m.receiveNotifications);
    const mutedRecipients = assigned.filter((m) => !m.receiveNotifications);

    let status: CoverageStatus = "gap";
    if (activeRecipients.length > 0) status = "active";
    else if (mutedRecipients.length > 0) status = "muted";

    return { location, status, activeRecipients, mutedRecipients };
  });
}

const STATUS_RANK: Record<CoverageStatus, number> = {
  gap: 0,
  muted: 1,
  active: 2,
};

/** Sort so the riskiest locations (gaps, then muted) surface first. */
export function sortCoverageByRisk(coverage: LocationCoverage[]): LocationCoverage[] {
  return [...coverage].sort((a, b) => {
    const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (rank !== 0) return rank;
    return a.location.localeCompare(b.location);
  });
}
