import { prisma } from "@/lib/prisma";
import { formatInNZT } from "@/lib/timezone";
import { dayKeyToDbDate } from "@/lib/shift-day-themes";
import {
  dayOfWeekForDayKey,
  normalizeLeadName,
  resolveDayLeads,
  type DayLeads,
  type DayLeadsMap,
} from "@/lib/day-leads";

/**
 * The Chef and FOH Manager for each given service day, resolved from the
 * standard rosters and that day's overrides.
 */
export async function getDayLeads(
  days: Array<{ location: string; dayKey: string }>
): Promise<DayLeadsMap> {
  if (days.length === 0) return {};

  const locations = [...new Set(days.map((d) => d.location))];
  const dayKeys = days.map((d) => d.dayKey).sort();

  const [rosters, overrides] = await Promise.all([
    prisma.dayLeadRoster.findMany({
      where: { location: { in: locations } },
      select: { location: true, dayOfWeek: true, chef: true, fohManager: true },
    }),
    prisma.dayLeadOverride.findMany({
      where: {
        location: { in: locations },
        date: {
          gte: dayKeyToDbDate(dayKeys[0]),
          lte: dayKeyToDbDate(dayKeys[dayKeys.length - 1]),
        },
      },
      select: { location: true, date: true, chef: true, fohManager: true },
    }),
  ]);

  return resolveDayLeads(days, rosters, overrides);
}

/**
 * Leads for every day these shifts run on - the calendar's view of them.
 * Days without shifts never get leads, so a closed Monday stays blank even
 * when Monday has a standard roster.
 */
export async function getDayLeadsForShifts(
  shifts: Array<{ start: Date; location: string | null }>
): Promise<DayLeadsMap> {
  const seen = new Set<string>();
  const days: Array<{ location: string; dayKey: string }> = [];
  for (const shift of shifts) {
    if (!shift.location) continue;
    const dayKey = formatInNZT(shift.start, "yyyy-MM-dd");
    const key = `${shift.location}|${dayKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    days.push({ location: shift.location, dayKey });
  }
  return getDayLeads(days);
}

/** Everything the admin day editor needs for one day at one location. */
export interface DayLeadsEditorState {
  /** The standard roster for this weekday (nulls when none is set). */
  standard: DayLeads;
  /** This day's own changes (nulls where it follows the standard roster). */
  override: DayLeads;
  /** The location's whole standard roster, keyed by dayOfWeek (0=Sun). */
  roster: Record<number, DayLeads>;
  /** Names used at this location before, for quick entry. */
  suggestions: string[];
}

export async function getDayLeadsEditorState(
  location: string,
  dayKey: string
): Promise<DayLeadsEditorState> {
  const [rosterRows, override, recentOverrides] = await Promise.all([
    prisma.dayLeadRoster.findMany({
      where: { location },
      select: { dayOfWeek: true, chef: true, fohManager: true },
    }),
    prisma.dayLeadOverride.findUnique({
      where: { location_date: { location, date: dayKeyToDbDate(dayKey) } },
      select: { chef: true, fohManager: true },
    }),
    prisma.dayLeadOverride.findMany({
      where: { location },
      select: { chef: true, fohManager: true },
      orderBy: { date: "desc" },
      take: 100,
    }),
  ]);

  const roster: Record<number, DayLeads> = {};
  for (const row of rosterRows) {
    roster[row.dayOfWeek] = { chef: row.chef, fohManager: row.fohManager };
  }

  // De-duplicated case-insensitively, so "sam" and "Sam" offer one name
  const names = new Map<string, string>();
  for (const row of [...rosterRows, ...recentOverrides]) {
    for (const name of [row.chef, row.fohManager]) {
      if (!name) continue;
      const normalized = normalizeLeadName(name);
      names.set(normalized.toLowerCase(), normalized);
    }
  }

  return {
    standard: roster[dayOfWeekForDayKey(dayKey)] ?? {
      chef: null,
      fohManager: null,
    },
    override: override ?? { chef: null, fohManager: null },
    roster,
    suggestions: [...names.values()].sort((a, b) => a.localeCompare(b)),
  };
}
