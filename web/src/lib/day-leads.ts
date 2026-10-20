import { z } from "zod";
import { dbDateToDayKey, isDayKey } from "@/lib/shift-day-themes";

/**
 * Day leads: the Chef and FOH Manager running a service day at a location,
 * shown to volunteers by first name on the shift calendar.
 *
 * Each location has a standard weekly roster (who usually runs Tuesdays, who
 * runs Wednesdays...), and any single day can override it when someone swaps
 * or covers. Overrides work field by field, so changing tonight's chef keeps
 * the standard FOH Manager. Days use the same "yyyy-MM-dd" NZ day keys as day
 * themes and the shift calendar.
 */

/** Matches the VarChar(40) columns. Plenty for a first name. */
export const DAY_LEAD_NAME_MAX_LENGTH = 40;

export const DAY_LEAD_ROLES = ["chef", "fohManager"] as const;
export type DayLeadRole = (typeof DAY_LEAD_ROLES)[number];

export const DAY_LEAD_ROLE_LABELS: Record<DayLeadRole, string> = {
  chef: "Chef",
  fohManager: "FOH Manager",
};

/** A day's leads by first name. Null means nobody is listed for that role. */
export interface DayLeads {
  chef: string | null;
  fohManager: string | null;
}

/** Leads keyed by location name, then by "yyyy-MM-dd" day key. */
export type DayLeadsMap = Record<string, Record<string, DayLeads>>;

/** A standard roster or override row, as read from the database. */
interface DayLeadsRow {
  location: string;
  chef: string | null;
  fohManager: string | null;
}

export interface DayLeadRosterRow extends DayLeadsRow {
  dayOfWeek: number;
}

export interface DayLeadOverrideRow extends DayLeadsRow {
  date: Date;
}

/** Weekdays in roster order (Monday first, as the restaurants plan weeks). */
export const ROSTER_WEEKDAYS = [
  { dayOfWeek: 1, label: "Monday" },
  { dayOfWeek: 2, label: "Tuesday" },
  { dayOfWeek: 3, label: "Wednesday" },
  { dayOfWeek: 4, label: "Thursday" },
  { dayOfWeek: 5, label: "Friday" },
  { dayOfWeek: 6, label: "Saturday" },
  { dayOfWeek: 0, label: "Sunday" },
] as const;

/** Day of the week (0=Sun ... 6=Sat) of a "yyyy-MM-dd" NZ day key. */
export function dayOfWeekForDayKey(dayKey: string): number {
  return new Date(`${dayKey}T00:00:00.000Z`).getUTCDay();
}

/** Collapse runs of whitespace and trim. An empty result means "nobody". */
export function normalizeLeadName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

/** True when neither role has a name. */
export function isEmptyDayLeads(leads: DayLeads): boolean {
  return !leads.chef && !leads.fohManager;
}

/**
 * The leads for each requested day: the day's override where it names
 * someone, the location's standard roster for that weekday otherwise. Days
 * with nobody in either role are left out of the map.
 */
export function resolveDayLeads(
  days: Array<{ location: string; dayKey: string }>,
  rosters: DayLeadRosterRow[],
  overrides: DayLeadOverrideRow[]
): DayLeadsMap {
  const rosterByKey = new Map(
    rosters.map((row) => [`${row.location}|${row.dayOfWeek}`, row])
  );
  const overrideByKey = new Map(
    overrides.map((row) => [`${row.location}|${dbDateToDayKey(row.date)}`, row])
  );

  const map: DayLeadsMap = {};
  for (const { location, dayKey } of days) {
    const standard = rosterByKey.get(
      `${location}|${dayOfWeekForDayKey(dayKey)}`
    );
    const override = overrideByKey.get(`${location}|${dayKey}`);
    const leads: DayLeads = {
      chef: override?.chef || standard?.chef || null,
      fohManager: override?.fohManager || standard?.fohManager || null,
    };
    if (!isEmptyDayLeads(leads)) (map[location] ??= {})[dayKey] = leads;
  }
  return map;
}

const leadNameSchema = z
  .string({ error: "Names must be text" })
  .transform(normalizeLeadName)
  .pipe(
    z
      .string()
      .max(
        DAY_LEAD_NAME_MAX_LENGTH,
        `Keep names to ${DAY_LEAD_NAME_MAX_LENGTH} characters or fewer`
      )
  );

const locationSchema = z
  .string({ error: "Location is required" })
  .trim()
  .min(1, "Location is required");

/**
 * Body for PUT /api/admin/day-leads: one day's changes to the standard
 * roster. An empty name puts that role back on the standard roster.
 */
export const dayLeadOverrideSchema = z.object({
  date: z
    .string({ error: "Date is required" })
    .refine(isDayKey, "Date must be a valid YYYY-MM-DD day"),
  location: locationSchema,
  chef: leadNameSchema,
  fohManager: leadNameSchema,
});

export type DayLeadOverrideInput = z.infer<typeof dayLeadOverrideSchema>;

/**
 * Body for PUT /api/admin/day-leads/roster: a location's whole standard
 * roster. Weekdays left out, or with both names empty, have no standard leads.
 */
export const dayLeadRosterSchema = z.object({
  location: locationSchema,
  days: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        chef: leadNameSchema,
        fohManager: leadNameSchema,
      })
    )
    .max(7)
    .refine(
      (days) => new Set(days.map((d) => d.dayOfWeek)).size === days.length,
      "Each weekday can only appear once"
    ),
});

export type DayLeadRosterInput = z.infer<typeof dayLeadRosterSchema>;
