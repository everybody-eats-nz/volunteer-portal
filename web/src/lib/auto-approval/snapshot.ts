import { Prisma } from "@/generated/client";
import { prisma } from "@/lib/prisma";
import { calculateAge } from "@/lib/utils";
import type { DescribeContext, ShiftContext, VolunteerSnapshot } from "./types";

interface SnapshotRow {
  id: string;
  name: string | null;
  email: string;
  profilePhotoUrl: string | null;
  volunteerGrade: "GREEN" | "YELLOW" | "PINK";
  createdAt: Date;
  dateOfBirth: Date | null;
  completedShiftAdjustment: number;
  completedShifts: bigint;
  canceledShifts: bigint;
  hasShiftTypeExperience: boolean | null;
  labelIds: string[] | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Resolving the whole roster means aggregating every signup, which costs real
 * time on a 10k-volunteer database. Paging, filtering and typing in the rule
 * editor all re-ask the same question, so the full-roster result is held
 * briefly. Volunteer totals don't move second to second, and this is a
 * "what would happen" preview - a slightly stale roster is the right trade.
 *
 * The single-volunteer path is never cached: it runs on the signup hot path
 * and has to see the volunteer exactly as they are.
 */
const ROSTER_CACHE_TTL_MS = 30_000;

const rosterCache = new Map<
  string,
  { expires: number; snapshots: VolunteerSnapshot[] }
>();

export function clearVolunteerSnapshotCache() {
  rosterCache.clear();
}

/**
 * Resolves volunteer stats in a single aggregate query rather than pulling
 * every signup into memory. The same query backs both the one-volunteer path
 * at signup time and the whole-roster coverage preview, so the numbers an
 * admin previews are by construction the numbers the evaluator will use.
 *
 * Pass `userIds` to scope it; omit for every active volunteer.
 */
export async function getVolunteerSnapshots(
  shiftTypeId: string,
  options: { userIds?: string[] } = {}
): Promise<VolunteerSnapshot[]> {
  const { userIds } = options;
  if (userIds && userIds.length === 0) return [];

  if (!userIds) {
    const cached = rosterCache.get(shiftTypeId);
    if (cached && cached.expires > Date.now()) return cached.snapshots;
  }

  // The user filter has to reach inside the CTEs, not just the outer query -
  // otherwise the single-volunteer path taken on every signup would aggregate
  // the entire Signup table before throwing all but one row away.
  const userFilter = userIds
    ? Prisma.sql`u.id IN (${Prisma.join(userIds)})`
    : Prisma.sql`u.role = 'VOLUNTEER' AND u."archivedAt" IS NULL`;
  const historyFilter = userIds
    ? Prisma.sql`WHERE sg."userId" IN (${Prisma.join(userIds)})`
    : Prisma.empty;
  const labelFilter = userIds
    ? Prisma.sql`WHERE "userId" IN (${Prisma.join(userIds)})`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<SnapshotRow[]>`
    WITH history AS (
      SELECT
        sg."userId",
        COUNT(*) FILTER (
          WHERE sg.status = 'CONFIRMED' AND sh."end" < NOW()
        ) AS completed,
        COUNT(*) FILTER (
          WHERE sg.status = 'CANCELED'
            AND sg."canceledAt" IS NOT NULL
            AND sg."previousStatus" = 'CONFIRMED'
        ) AS canceled,
        BOOL_OR(
          sg.status = 'CONFIRMED'
          AND sh."end" < NOW()
          AND sh."shiftTypeId" = ${shiftTypeId}
        ) AS has_experience
      FROM "Signup" sg
      JOIN "Shift" sh ON sh.id = sg."shiftId"
      ${historyFilter}
      GROUP BY sg."userId"
    ),
    labels AS (
      SELECT "userId", ARRAY_AGG("labelId") AS label_ids
      FROM "UserCustomLabel"
      ${labelFilter}
      GROUP BY "userId"
    )
    SELECT
      u.id,
      u.name,
      u.email,
      u."profilePhotoUrl",
      u."volunteerGrade"::text AS "volunteerGrade",
      u."createdAt",
      u."dateOfBirth",
      u."completedShiftAdjustment",
      COALESCE(h.completed, 0) AS "completedShifts",
      COALESCE(h.canceled, 0) AS "canceledShifts",
      COALESCE(h.has_experience, FALSE) AS "hasShiftTypeExperience",
      l.label_ids AS "labelIds"
    FROM "User" u
    LEFT JOIN history h ON h."userId" = u.id
    LEFT JOIN labels l ON l."userId" = u.id
    WHERE ${userFilter}
    ORDER BY u.name NULLS LAST, u.email
  `;

  const now = Date.now();

  const snapshots = rows.map((row) => {
    const completedShifts =
      Number(row.completedShifts) + (row.completedShiftAdjustment ?? 0);
    const canceledShifts = Number(row.canceledShifts);
    const total = completedShifts + canceledShifts;

    return {
      userId: row.id,
      name: row.name,
      email: row.email,
      profilePhotoUrl: row.profilePhotoUrl,
      volunteerGrade: row.volunteerGrade,
      createdAt: row.createdAt,
      accountAgeDays: Math.max(
        0,
        Math.floor((now - row.createdAt.getTime()) / DAY_MS)
      ),
      completedShifts,
      canceledShifts,
      // No history reads as perfect rather than as zero - a brand new
      // volunteer shouldn't be scored as unreliable.
      attendanceRate: total > 0 ? (completedShifts / total) * 100 : 100,
      age: row.dateOfBirth ? calculateAge(row.dateOfBirth) : null,
      labelIds: row.labelIds ?? [],
      hasShiftTypeExperience: row.hasShiftTypeExperience ?? false,
    } satisfies VolunteerSnapshot;
  });

  if (!userIds) {
    rosterCache.set(shiftTypeId, {
      expires: now + ROSTER_CACHE_TTL_MS,
      snapshots,
    });
  }

  return snapshots;
}

export async function getVolunteerSnapshot(
  userId: string,
  shiftTypeId: string
): Promise<VolunteerSnapshot | null> {
  const [snapshot] = await getVolunteerSnapshots(shiftTypeId, {
    userIds: [userId],
  });
  return snapshot ?? null;
}

export function buildShiftContext(shift: {
  id?: string | null;
  shiftTypeId: string;
  shiftType?: { name: string } | null;
  location: string | null;
  start: Date;
}): ShiftContext {
  return {
    shiftId: shift.id ?? null,
    shiftTypeId: shift.shiftTypeId,
    shiftTypeName: shift.shiftType?.name ?? null,
    location: shift.location,
    start: shift.start,
    daysInAdvance: Math.floor((shift.start.getTime() - Date.now()) / DAY_MS),
  };
}

/** Label names, so ids in rules and traces render as something recognisable. */
export async function getDescribeContext(): Promise<DescribeContext> {
  const labels = await prisma.customLabel.findMany({
    select: { id: true, name: true, icon: true },
  });
  return {
    labelNames: new Map(labels.map((l) => [l.id, { name: l.name, icon: l.icon }])),
  };
}
