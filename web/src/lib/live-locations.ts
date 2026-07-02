import { cache } from "react";

import { prisma } from "@/lib/prisma";

/** How long a freshly launched location keeps its "New" badge. */
export const NEW_LOCATION_WINDOW_DAYS = 30;

export interface LiveLocation {
  name: string;
  address: string | null;
  isPopup: boolean;
  /** Launched within the last NEW_LOCATION_WINDOW_DAYS - show a "New" badge. */
  isNew: boolean;
}

/**
 * Locations volunteers can actually browse: active (or ad-hoc shift venues)
 * with at least one upcoming shift.
 *
 * Admins usually create a Location row well before its shifts exist. Those
 * rows stay out of this list until the first upcoming shifts appear, at which
 * point `launchedAt` is stamped and the location is flagged `isNew` for
 * NEW_LOCATION_WINDOW_DAYS - that flag drives the subtle "New" badges in the
 * web and mobile location switchers.
 *
 * Exported uncached for unit tests; use getLiveLocations everywhere else.
 */
export async function getLiveLocationsUncached(): Promise<LiveLocation[]> {
  const now = new Date();

  const [shiftLocations, locationRows] = await Promise.all([
    prisma.shift.findMany({
      where: { start: { gte: now }, location: { not: null } },
      select: { location: true },
      distinct: ["location"],
    }),
    prisma.location.findMany({
      select: {
        id: true,
        name: true,
        address: true,
        isActive: true,
        isPopup: true,
        launchedAt: true,
      },
    }),
  ]);

  const normalizeName = (name: string) => name.replace(/\s+/g, " ").trim();

  const liveNames = new Set(
    shiftLocations
      .map((s) => normalizeName(s.location ?? ""))
      .filter((name) => name.length > 0)
  );
  // Keyed by normalized name so a Location row with stray whitespace still
  // matches the (normalized) shift venue strings.
  const rowByName = new Map(
    locationRows.map((row) => [normalizeName(row.name), row])
  );

  // Stamp launchedAt the first time a location shows up with upcoming shifts.
  const justLaunched = locationRows.filter(
    (row) =>
      row.isActive && !row.launchedAt && liveNames.has(normalizeName(row.name))
  );
  if (justLaunched.length > 0) {
    // launchedAt: null in the WHERE keeps concurrent requests from
    // re-stamping a location one of them already launched.
    await prisma.location.updateMany({
      where: { id: { in: justLaunched.map((row) => row.id) }, launchedAt: null },
      data: { launchedAt: now },
    });
  }
  const justLaunchedIds = new Set(justLaunched.map((row) => row.id));

  const newCutoff = new Date(
    now.getTime() - NEW_LOCATION_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );

  return [...liveNames]
    .filter((name) => rowByName.get(name)?.isActive !== false)
    .sort()
    .map((name) => {
      const row = rowByName.get(name);
      const launchedAt = row
        ? justLaunchedIds.has(row.id)
          ? now
          : row.launchedAt
        : null;
      return {
        name,
        address: row?.address ?? null,
        isPopup: row?.isPopup ?? false,
        isNew: launchedAt !== null && launchedAt > newCutoff,
      };
    });
}

/**
 * Wrapped in React cache() so generateMetadata and the page render share one
 * query per request.
 */
export const getLiveLocations = cache(getLiveLocationsUncached);
