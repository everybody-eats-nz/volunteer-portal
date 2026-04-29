import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/client";
import { nowInNZT } from "@/lib/timezone";
import {
  UNSPECIFIED_LOCATION,
  type FunnelStageKey,
  type FurthestStage,
  type RecruitmentSegment,
  type RecruitmentSegmentResult,
  type RecruitmentSegmentUser,
  type TimeBucketKey,
} from "@/lib/recruitment-types";

const RESULT_CAP = 500;

interface RawUserRow {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  profilePhotoUrl: string | null;
  defaultLocation: string | null;
  profileCompleted: boolean;
  createdAt: Date;
  firstShiftDate: Date | null;
  totalSignups: number | bigint;
  confirmedShifts: number | bigint;
}

function deriveFurthestStage(row: RawUserRow): FurthestStage {
  if (Number(row.confirmedShifts) > 0) return "completedShift";
  if (Number(row.totalSignups) > 0) return "signedUp";
  if (row.profileCompleted) return "profileComplete";
  return "registered";
}

function toUser(row: RawUserRow): RecruitmentSegmentUser {
  const days =
    row.firstShiftDate
      ? Math.round(
          (row.firstShiftDate.getTime() - row.createdAt.getTime()) / 86400000
        )
      : null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    firstName: row.firstName,
    lastName: row.lastName,
    profilePhotoUrl: row.profilePhotoUrl,
    defaultLocation: row.defaultLocation,
    profileCompleted: row.profileCompleted,
    createdAt: row.createdAt.toISOString(),
    firstShiftDate: row.firstShiftDate ? row.firstShiftDate.toISOString() : null,
    daysToFirstShift: days,
    furthestStage: deriveFurthestStage(row),
  };
}

// "Unspecified" segment matches NULL or empty defaultLocation; otherwise exact match.
function defaultLocationMatchSql(loc: string): Prisma.Sql {
  if (loc === UNSPECIFIED_LOCATION) {
    return Prisma.sql`(u."defaultLocation" IS NULL OR u."defaultLocation" = '')`;
  }
  return Prisma.sql`u."defaultLocation" = ${loc}`;
}

// Mirrors the global location filter behaviour of getRecruitmentData (matches
// the JSON-encoded availableLocations field).
function availableLocationsFilterSql(filter: string | null): Prisma.Sql {
  if (!filter || filter === "all") return Prisma.empty;
  return Prisma.sql`AND u."availableLocations" LIKE ${`%"${filter}"%`}`;
}

function periodStart(months: number): Date {
  const nz = nowInNZT();
  nz.setMonth(nz.getMonth() - months);
  return new Date(nz.getTime());
}

function nowDate(): Date {
  return new Date(nowInNZT().getTime());
}

interface QueryArgs {
  segment: RecruitmentSegment;
  months: number;
  locationFilter: string | null;
}

export async function getRecruitmentSegmentUsers(
  args: QueryArgs
): Promise<RecruitmentSegmentResult> {
  const { segment, months, locationFilter } = args;
  const now = nowDate();
  const locFilter = availableLocationsFilterSql(locationFilter);
  const locMatch = defaultLocationMatchSql(segment.location);

  // Per-segment WHERE/HAVING clauses. The user_stats CTE shape is shared.
  let dateRange: Prisma.Sql;
  let stageHaving: Prisma.Sql;

  switch (segment.chart) {
    case "trend":
      // The trend chart is always 12 months; we filter to the exact NZ month.
      dateRange = Prisma.sql`
        AND to_char(
          date_trunc('month', (u."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Pacific/Auckland'),
          'YYYY-MM'
        ) = ${segment.monthKey}
      `;
      stageHaving = Prisma.sql`TRUE`;
      break;

    case "funnel": {
      const start = periodStart(months);
      dateRange = Prisma.sql`AND u."createdAt" >= ${start} AND u."createdAt" < ${now}`;
      stageHaving = funnelStageHaving(segment.stage);
      break;
    }

    case "timeToFirstShift": {
      const start = periodStart(months);
      dateRange = Prisma.sql`AND u."createdAt" >= ${start} AND u."createdAt" < ${now}`;
      stageHaving = timeBucketHaving(segment.bucket);
      break;
    }
  }

  const cte = Prisma.sql`
    WITH user_stats AS (
      SELECT
        u.id,
        u.email,
        u.name,
        u."firstName"        AS "firstName",
        u."lastName"         AS "lastName",
        u."profilePhotoUrl"  AS "profilePhotoUrl",
        u."defaultLocation"  AS "defaultLocation",
        u."profileCompleted" AS "profileCompleted",
        u."createdAt"        AS "createdAt",
        COUNT(sg.id)::int AS "totalSignups",
        COUNT(sg.id) FILTER (
          WHERE sg.status = 'CONFIRMED'::"SignupStatus" AND sh."end" < ${now}
        )::int AS "confirmedShifts",
        MIN(sh."end") FILTER (
          WHERE sg.status = 'CONFIRMED'::"SignupStatus" AND sh."end" < ${now}
        ) AS "firstShiftDate"
      FROM "User" u
      LEFT JOIN "Signup" sg ON sg."userId" = u.id
      LEFT JOIN "Shift"  sh ON sh.id = sg."shiftId"
      WHERE u.role = 'VOLUNTEER'::"Role"
        AND ${locMatch}
        ${dateRange}
        ${locFilter}
      GROUP BY u.id
    )
  `;

  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<RawUserRow[]>`
      ${cte}
      SELECT *
      FROM user_stats us
      WHERE ${stageHaving}
      ORDER BY us."createdAt" DESC
      LIMIT ${RESULT_CAP}
    `,
    prisma.$queryRaw<Array<{ total: bigint }>>`
      ${cte}
      SELECT COUNT(*)::bigint AS total
      FROM user_stats us
      WHERE ${stageHaving}
    `,
  ]);

  return {
    users: rows.map(toUser),
    total: Number(countRows[0]?.total ?? 0),
    cap: RESULT_CAP,
  };
}

function funnelStageHaving(stage: FunnelStageKey): Prisma.Sql {
  switch (stage) {
    case "totalRegistrations":
      return Prisma.sql`TRUE`;
    case "profileComplete":
      return Prisma.sql`us."profileCompleted" = TRUE`;
    case "signedUp":
      return Prisma.sql`us."totalSignups" > 0`;
    case "completedShift":
      return Prisma.sql`us."confirmedShifts" > 0`;
  }
}

function timeBucketHaving(bucket: TimeBucketKey): Prisma.Sql {
  // Only users with a confirmed first shift fall into a bucket.
  // Day diff matches the boundaries used in getRecruitmentData (lib/recruitment.ts).
  const dayDiff = Prisma.sql`(EXTRACT(EPOCH FROM (us."firstShiftDate" - us."createdAt")) / 86400.0)`;
  switch (bucket) {
    case "sameDay":
      return Prisma.sql`us."firstShiftDate" IS NOT NULL AND ${dayDiff} < 1`;
    case "within3Days":
      return Prisma.sql`us."firstShiftDate" IS NOT NULL AND ${dayDiff} >= 1 AND ${dayDiff} <= 3`;
    case "within7Days":
      return Prisma.sql`us."firstShiftDate" IS NOT NULL AND ${dayDiff} > 3 AND ${dayDiff} <= 7`;
    case "within14Days":
      return Prisma.sql`us."firstShiftDate" IS NOT NULL AND ${dayDiff} > 7 AND ${dayDiff} <= 14`;
    case "within30Days":
      return Prisma.sql`us."firstShiftDate" IS NOT NULL AND ${dayDiff} > 14 AND ${dayDiff} <= 30`;
    case "within60Days":
      return Prisma.sql`us."firstShiftDate" IS NOT NULL AND ${dayDiff} > 30 AND ${dayDiff} <= 60`;
    case "within90Days":
      return Prisma.sql`us."firstShiftDate" IS NOT NULL AND ${dayDiff} > 60 AND ${dayDiff} <= 90`;
    case "over90Days":
      return Prisma.sql`us."firstShiftDate" IS NOT NULL AND ${dayDiff} > 90`;
  }
}
