import { Prisma, SignupStatus } from "@/generated/client";
import { prisma } from "@/lib/prisma";

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

export interface AnnouncementTargeting {
  targetLocations: string[];
  targetGrades: string[];
  targetLabelIds: string[];
  targetUserIds: string[];
  targetShiftIds: string[];
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
  };
}

/**
 * Build the SQL conditions that match volunteers receiving an announcement.
 * Each dimension is OR-within, AND-across. Empty array = "all" for that
 * dimension. Returns conditions joined for use in WHERE clauses against the
 * "User" table.
 */
function buildRecipientConditions(t: AnnouncementTargeting): Prisma.Sql {
  const conditions: Prisma.Sql[] = [Prisma.sql`role = 'VOLUNTEER'`];

  if (t.targetLocations.length > 0) {
    conditions.push(
      Prisma.sql`"defaultLocation" = ANY(ARRAY[${Prisma.join(t.targetLocations)}]::text[])`
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
