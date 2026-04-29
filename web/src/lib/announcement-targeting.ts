import { Prisma } from "@/generated/client";
import { prisma } from "@/lib/prisma";

/**
 * Statuses that count as "currently signed up to a shift" for announcement
 * targeting. Mirrors the statuses shown on /admin/shifts. CANCELED is omitted —
 * a cancelled volunteer should not receive announcements pinned to that shift.
 */
export const ANNOUNCEMENT_SHIFT_TARGET_STATUSES = [
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
    const statuses = ANNOUNCEMENT_SHIFT_TARGET_STATUSES.map((s) => s);
    conditions.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM "Signup"
        WHERE "userId" = "User".id
        AND "shiftId" = ANY(ARRAY[${Prisma.join(t.targetShiftIds)}]::text[])
        AND "status"::text = ANY(ARRAY[${Prisma.join(statuses)}]::text[])
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
