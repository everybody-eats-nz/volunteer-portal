import { Prisma, SignupStatus } from "@/generated/client";
import { prisma } from "@/lib/prisma";
import { createNZDate, formatInNZT } from "@/lib/timezone";

/**
 * Statuses that count as "currently signed up to a shift" for announcement
 * targeting. Mirrors the statuses shown on /admin/shifts. CANCELED is omitted —
 * a cancelled volunteer should not receive announcements pinned to that shift.
 */
export const ANNOUNCEMENT_SHIFT_TARGET_STATUSES: readonly SignupStatus[] = [
  "CONFIRMED",
  "PENDING",
  "WAITLISTED",
  "REGULAR_PENDING",
  "NO_SHOW",
] as const;

/**
 * Statuses that count as "actually worked this shift" for shift-history
 * targeting. Deliberately narrower than the set above: a waitlisted or
 * no-show volunteer never worked the shift, so they don't belong in a
 * "volunteers who worked at Onehunga recently" audience.
 */
export const ANNOUNCEMENT_ACTIVITY_STATUSES: readonly SignupStatus[] = [
  "CONFIRMED",
] as const;

export interface AnnouncementTargeting {
  targetLocations: string[];
  targetGrades: string[];
  targetLabelIds: string[];
  targetUserIds: string[];
  targetShiftIds: string[];
  /** Shift locations to count activity at. Empty = any location. */
  targetActivityLocations: string[];
  /** Only count shifts that ended on/after this. Null = no lower bound. */
  targetActivityFrom: Date | null;
  /** Only count shifts that ended on/before this. Null = no upper bound. */
  targetActivityTo: Date | null;
  /** Minimum matching shifts. Null switches the whole dimension off. */
  targetActivityMinShifts: number | null;
}

/** Pluck the targeting fields out of an Announcement row. */
export function targetingFromAnnouncement(
  ann: AnnouncementTargeting
): AnnouncementTargeting {
  return {
    targetLocations: ann.targetLocations,
    targetGrades: ann.targetGrades,
    targetLabelIds: ann.targetLabelIds,
    targetUserIds: ann.targetUserIds,
    targetShiftIds: ann.targetShiftIds,
    targetActivityLocations: ann.targetActivityLocations,
    targetActivityFrom: ann.targetActivityFrom,
    targetActivityTo: ann.targetActivityTo,
    targetActivityMinShifts: ann.targetActivityMinShifts,
  };
}

/** Just the shift-history dimension, for callers that don't have the rest. */
export type ActivityTargeting = Pick<
  AnnouncementTargeting,
  | "targetActivityLocations"
  | "targetActivityFrom"
  | "targetActivityTo"
  | "targetActivityMinShifts"
>;

/** Is the shift-history dimension switched on for this targeting? */
export function hasActivityTargeting(t: {
  targetActivityMinShifts: number | null;
}): boolean {
  return t.targetActivityMinShifts !== null && t.targetActivityMinShifts >= 1;
}

/** A shift the volunteer worked — a confirmed signup on a finished shift. */
export interface WorkedShift {
  location: string | null;
  end: Date;
}

/**
 * In-memory twin of the shift-history SQL condition, for the mobile feed —
 * which loads announcements for one known user and filters them in app code.
 * Keep this in step with the `hasActivityTargeting` branch of
 * `buildRecipientConditions`, or the feed will show a volunteer an
 * announcement they were never emailed (or hide one they were).
 *
 * `workedShifts` must already be limited to shifts the user actually worked;
 * this only applies the announcement's own location and date narrowing.
 */
export function userMatchesActivityTargeting(
  workedShifts: WorkedShift[],
  t: ActivityTargeting
): boolean {
  if (!hasActivityTargeting(t)) return true;

  const matching = workedShifts.filter((shift) => {
    if (
      t.targetActivityLocations.length > 0 &&
      (shift.location === null ||
        !t.targetActivityLocations.includes(shift.location))
    ) {
      return false;
    }
    if (t.targetActivityFrom && shift.end < t.targetActivityFrom) return false;
    if (t.targetActivityTo && shift.end > t.targetActivityTo) return false;
    return true;
  });

  return matching.length >= (t.targetActivityMinShifts ?? 1);
}

const MAX_ACTIVITY_MIN_SHIFTS = 999;

/**
 * Coerce an untrusted request body into targeting. Shared by the create and
 * recipient-count routes so the preview count can't drift from what actually
 * gets sent.
 *
 * Activity dates arrive as `YYYY-MM-DD` from the admin form and are anchored
 * to NZ calendar days — "from" at midnight, "to" at the end of that day — so
 * a range reads inclusively the way an admin picked it.
 */
export function parseTargetingFromRequest(
  body: Record<string, unknown>
): AnnouncementTargeting {
  const stringArray = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

  const rawMinShifts = body.targetActivityMinShifts;
  const minShifts =
    typeof rawMinShifts === "number" && Number.isFinite(rawMinShifts)
      ? Math.min(Math.max(Math.trunc(rawMinShifts), 1), MAX_ACTIVITY_MIN_SHIFTS)
      : null;

  return {
    targetLocations: stringArray(body.targetLocations),
    targetGrades: stringArray(body.targetGrades),
    targetLabelIds: stringArray(body.targetLabelIds),
    targetUserIds: stringArray(body.targetUserIds),
    targetShiftIds: stringArray(body.targetShiftIds),
    targetActivityLocations: stringArray(body.targetActivityLocations),
    targetActivityFrom: parseActivityDate(body.targetActivityFrom, "start"),
    targetActivityTo: parseActivityDate(body.targetActivityTo, "end"),
    targetActivityMinShifts: minShifts,
  };
}

/**
 * Turn a `YYYY-MM-DD` string from the date inputs into the UTC instant for the
 * start or end of that NZ calendar day. Anything unparseable becomes null so a
 * malformed date widens the window rather than throwing mid-send.
 *
 * An impossible-but-well-formed date (`2026-13-99`, `2026-02-31`) does not
 * produce an invalid Date — the underlying constructor rolls the components
 * over into a real date in a later month. Silently accepting that would move a
 * window bound to a day nobody asked for and email the wrong audience, so the
 * result is checked back against the string it came from. The date inputs
 * can't produce these; a direct API call can.
 */
function parseActivityDate(value: unknown, edge: "start" | "end"): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const date =
    edge === "start"
      ? createNZDate(value, 0, 0, 0)
      : createNZDate(value, 23, 59, 59);

  const roundTrips =
    !Number.isNaN(date.getTime()) &&
    formatInNZT(date, "yyyy-MM-dd") === value;
  if (!roundTrips) {
    console.warn(
      `[announcement-targeting] ignoring unparseable activity ${edge} date: ${value}`
    );
    return null;
  }
  return date;
}

/**
 * Build the SQL conditions that match volunteers receiving an announcement.
 * Each dimension is OR-within, AND-across. Empty array = "all" for that
 * dimension. Returns conditions joined for use in WHERE clauses against the
 * "User" table.
 */
function buildRecipientConditions(t: AnnouncementTargeting): Prisma.Sql {
  const conditions: Prisma.Sql[] = [Prisma.sql`TRUE`];

  if (t.targetLocations.length > 0) {
    const targetLocations = Prisma.sql`ARRAY[${Prisma.join(t.targetLocations)}]::text[]`;
    // A volunteer belongs to a location when it's their default OR in their
    // availableLocations list. That column is a JSON-stringified array in a
    // text column (with legacy plain-text values like "Glen Innes" in old
    // rows), so no ::jsonb cast — one malformed row would abort the whole
    // query. Matching the element with its JSON quotes ('"Wellington"') keeps
    // the substring check exact for names that are prefixes of other names;
    // the trimmed equality branch covers the legacy plain-text rows.
    conditions.push(
      Prisma.sql`(
        "defaultLocation" = ANY(${targetLocations})
        OR EXISTS (
          SELECT 1 FROM unnest(${targetLocations}) AS target(loc)
          WHERE POSITION('"' || target.loc || '"' IN "availableLocations") > 0
             OR btrim("availableLocations") = target.loc
        )
      )`
    );
  }

  if (t.targetGrades.length > 0) {
    conditions.push(
      Prisma.sql`"volunteerGrade"::text = ANY(ARRAY[${Prisma.join(t.targetGrades)}]::text[])`
    );
  }

  if (t.targetLabelIds.length > 0) {
    conditions.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM "UserCustomLabel"
        WHERE "userId" = "User".id
        AND "labelId" = ANY(ARRAY[${Prisma.join(t.targetLabelIds)}]::text[])
      )`
    );
  }

  if (t.targetUserIds.length > 0) {
    conditions.push(
      Prisma.sql`"User".id = ANY(ARRAY[${Prisma.join(t.targetUserIds)}]::text[])`
    );
  }

  if (t.targetShiftIds.length > 0) {
    conditions.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM "Signup"
        WHERE "userId" = "User".id
        AND "shiftId" = ANY(ARRAY[${Prisma.join(t.targetShiftIds)}]::text[])
        AND "status"::text = ANY(ARRAY[${Prisma.join(ANNOUNCEMENT_SHIFT_TARGET_STATUSES.map((s) => s))}]::text[])
      )`
    );
  }

  if (hasActivityTargeting(t)) {
    // Shifts the volunteer actually worked: a confirmed signup on a shift that
    // has already finished. The optional narrowing clauses all key off the
    // shift's end time, so "between April and July" means shifts that finished
    // in that window rather than ones that merely started in it.
    const activityFilters: Prisma.Sql[] = [
      Prisma.sql`"Signup"."userId" = "User".id`,
      Prisma.sql`"Signup"."status"::text = ANY(ARRAY[${Prisma.join(ANNOUNCEMENT_ACTIVITY_STATUSES.map((s) => s))}]::text[])`,
      Prisma.sql`"Shift"."end" < NOW()`,
    ];

    if (t.targetActivityLocations.length > 0) {
      // Shifts with no location drop out here without an explicit IS NOT NULL:
      // `NULL = ANY(array)` evaluates to NULL, not true, so the row fails the
      // WHERE. That matches userMatchesActivityTargeting, which excludes them
      // outright.
      activityFilters.push(
        Prisma.sql`"Shift"."location" = ANY(ARRAY[${Prisma.join(t.targetActivityLocations)}]::text[])`
      );
    }
    if (t.targetActivityFrom) {
      activityFilters.push(Prisma.sql`"Shift"."end" >= ${t.targetActivityFrom}`);
    }
    if (t.targetActivityTo) {
      activityFilters.push(Prisma.sql`"Shift"."end" <= ${t.targetActivityTo}`);
    }

    // Both branches are correlated subqueries evaluated per candidate user, so
    // they lean on Signup(userId, …) to keep the per-user set small. The "at
    // least one shift" case is by far the common one, and EXISTS lets Postgres
    // stop at the first matching row instead of counting every shift the
    // volunteer ever worked.
    conditions.push(
      t.targetActivityMinShifts === 1
        ? Prisma.sql`EXISTS (
            SELECT 1
            FROM "Signup"
            JOIN "Shift" ON "Shift".id = "Signup"."shiftId"
            WHERE ${Prisma.join(activityFilters, " AND ")}
          )`
        : Prisma.sql`(
            SELECT COUNT(DISTINCT "Signup"."shiftId")
            FROM "Signup"
            JOIN "Shift" ON "Shift".id = "Signup"."shiftId"
            WHERE ${Prisma.join(activityFilters, " AND ")}
          ) >= ${t.targetActivityMinShifts}`
    );
  }

  return Prisma.join(conditions, " AND ");
}

/**
 * Count distinct volunteers matched by the given targeting. Used for the
 * admin form preview and for storing recipient counts on send.
 */
export async function countAnnouncementRecipients(
  t: AnnouncementTargeting
): Promise<number> {
  const where = buildRecipientConditions(t);
  const result = await prisma.$queryRaw<[{ count: bigint }]>(
    Prisma.sql`SELECT COUNT(*) AS count FROM "User" WHERE ${where}`
  );
  return Number(result[0].count);
}

/**
 * Find all volunteers matched by the given targeting, returning the fields
 * needed to send them a notification or email.
 */
export async function findAnnouncementRecipients(
  t: AnnouncementTargeting
): Promise<
  Array<{
    id: string;
    email: string;
    firstName: string | null;
    name: string | null;
  }>
> {
  const where = buildRecipientConditions(t);
  return prisma.$queryRaw<
    Array<{
      id: string;
      email: string;
      firstName: string | null;
      name: string | null;
    }>
  >(
    Prisma.sql`
      SELECT id, email, "firstName", name
      FROM "User"
      WHERE ${where}
    `
  );
}

export interface AnnouncementPickerShift {
  id: string;
  start: string;
  end: string;
  location: string | null;
  shiftTypeName: string;
  signupCount: number;
}

export interface AnnouncementPickerFilter {
  /** Hydrate exactly these shifts. Used to render selected-shift badges from
   *  query-string prefill (those shifts may sit outside the upcoming window). */
  ids?: string[];
  /** Optional location filter when listing upcoming shifts. */
  location?: string | null;
  /** How far ahead to look. Clamped to [1, 180]. Default 60. */
  daysAhead?: number;
}

/**
 * Hydrate a list of shifts for the announcement form's shift picker. The
 * `signupCount` returned counts only the statuses we treat as "associated
 * with the shift" for announcement targeting — see
 * ANNOUNCEMENT_SHIFT_TARGET_STATUSES.
 */
export async function findShiftsForAnnouncementPicker(
  filter: AnnouncementPickerFilter
): Promise<AnnouncementPickerShift[]> {
  const days = Math.min(Math.max(filter.daysAhead ?? 60, 1), 180);
  const now = new Date();
  const horizon = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const where = filter.ids?.length
    ? { id: { in: filter.ids.slice(0, 200) } }
    : {
        start: { gte: now, lte: horizon },
        ...(filter.location ? { location: filter.location } : {}),
      };

  const shifts = await prisma.shift.findMany({
    where,
    select: {
      id: true,
      start: true,
      end: true,
      location: true,
      shiftType: { select: { name: true } },
      _count: {
        select: {
          signups: {
            where: {
              status: { in: ANNOUNCEMENT_SHIFT_TARGET_STATUSES.map((s) => s) },
            },
          },
        },
      },
    },
    orderBy: { start: "asc" },
    take: 500,
  });

  return shifts.map((s) => ({
    id: s.id,
    start: s.start.toISOString(),
    end: s.end.toISOString(),
    location: s.location,
    shiftTypeName: s.shiftType.name,
    signupCount: s._count.signups,
  }));
}
