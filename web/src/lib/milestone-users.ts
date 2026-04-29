import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/client";
import { nowInNZT } from "@/lib/timezone";
import { UNSPECIFIED_LOCATION } from "@/lib/recruitment-types";
import {
  type MilestoneDistributionBand,
  type MilestoneSegment,
  type MilestoneSegmentResult,
  type MilestoneSegmentUser,
} from "@/lib/milestone-segment-types";

const RESULT_CAP = 500;
const PROJECTION_MONTHS = 12;

interface BaseUserRow {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  profilePhotoUrl: string | null;
  defaultLocation: string | null;
  totalShifts: number | bigint;
}

interface HitRow extends BaseUserRow {
  achievedAt: Date;
}

interface ProjectionRow extends BaseUserRow {
  recentShifts: number | bigint;
}

function defaultLocationMatchSql(loc: string): Prisma.Sql {
  if (loc === UNSPECIFIED_LOCATION) {
    return Prisma.sql`(u."defaultLocation" IS NULL OR u."defaultLocation" = '')`;
  }
  return Prisma.sql`u."defaultLocation" = ${loc}`;
}

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

function bandRangeSql(band: MilestoneDistributionBand): Prisma.Sql {
  switch (band) {
    case "d_1_9":
      return Prisma.sql`n BETWEEN 1 AND 9`;
    case "d_10_24":
      return Prisma.sql`n BETWEEN 10 AND 24`;
    case "d_25_49":
      return Prisma.sql`n BETWEEN 25 AND 49`;
    case "d_50_99":
      return Prisma.sql`n BETWEEN 50 AND 99`;
    case "d_100_199":
      return Prisma.sql`n BETWEEN 100 AND 199`;
    case "d_200_499":
      return Prisma.sql`n BETWEEN 200 AND 499`;
    case "d_500_plus":
      return Prisma.sql`n >= 500`;
  }
}

function baseUser(row: BaseUserRow): Omit<
  MilestoneSegmentUser,
  "monthlyRate" | "projectedMonths" | "achievedAt"
> {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    firstName: row.firstName,
    lastName: row.lastName,
    profilePhotoUrl: row.profilePhotoUrl,
    defaultLocation: row.defaultLocation,
    totalShifts: Number(row.totalShifts),
  };
}

interface Args {
  segment: MilestoneSegment;
  months: number;
  locationFilter: string | null;
}

export async function getMilestoneSegmentUsers(
  args: Args
): Promise<MilestoneSegmentResult> {
  const { segment, months, locationFilter } = args;
  const now = nowDate();
  const start = periodStart(months);
  const sixMonthsAgo = periodStart(6);
  const locFilter = availableLocationsFilterSql(locationFilter);
  const locMatch = defaultLocationMatchSql(segment.location);

  switch (segment.chart) {
    case "milestoneHits":
      return getHitUsers(
        segment.threshold,
        start,
        now,
        locMatch,
        locFilter
      );
    case "milestoneDistribution":
      return getDistributionUsers(segment.band, now, locMatch, locFilter);
    case "milestoneProjections":
      return getProjectionUsers(
        segment.threshold,
        sixMonthsAgo,
        now,
        locMatch,
        locFilter
      );
  }
}

async function getHitUsers(
  threshold: number,
  periodStartDate: Date,
  now: Date,
  locMatch: Prisma.Sql,
  locFilter: Prisma.Sql
): Promise<MilestoneSegmentResult> {
  const cte = Prisma.sql`
    WITH ranked AS (
      SELECT
        sg."userId" AS id,
        u.email,
        u.name,
        u."firstName"        AS "firstName",
        u."lastName"         AS "lastName",
        u."profilePhotoUrl"  AS "profilePhotoUrl",
        u."defaultLocation"  AS "defaultLocation",
        sh."end" AS shift_end,
        ROW_NUMBER() OVER (PARTITION BY sg."userId" ORDER BY sh."end") AS rn,
        COUNT(*) OVER (PARTITION BY sg."userId") AS total_shifts
      FROM "Signup" sg
      JOIN "Shift" sh ON sh.id = sg."shiftId"
      JOIN "User"  u  ON u.id  = sg."userId"
      WHERE sg.status = 'CONFIRMED'::"SignupStatus"
        AND sh."end" < ${now}
        AND u.role = 'VOLUNTEER'::"Role"
        AND ${locMatch}
        ${locFilter}
    ),
    filtered AS (
      SELECT
        id, email, name, "firstName", "lastName", "profilePhotoUrl",
        "defaultLocation",
        shift_end AS "achievedAt",
        total_shifts::int AS "totalShifts"
      FROM ranked
      WHERE rn = ${threshold}
        AND shift_end >= ${periodStartDate}
        AND shift_end < ${now}
    )
  `;

  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<HitRow[]>`
      ${cte}
      SELECT * FROM filtered
      ORDER BY "achievedAt" DESC
      LIMIT ${RESULT_CAP}
    `,
    prisma.$queryRaw<Array<{ total: bigint }>>`
      ${cte}
      SELECT COUNT(*)::bigint AS total FROM filtered
    `,
  ]);

  return {
    users: rows.map((row) => ({
      ...baseUser(row),
      monthlyRate: null,
      projectedMonths: null,
      achievedAt: row.achievedAt.toISOString(),
    })),
    total: Number(countRows[0]?.total ?? 0),
    cap: RESULT_CAP,
  };
}

async function getDistributionUsers(
  band: MilestoneDistributionBand,
  now: Date,
  locMatch: Prisma.Sql,
  locFilter: Prisma.Sql
): Promise<MilestoneSegmentResult> {
  const range = bandRangeSql(band);
  const cte = Prisma.sql`
    WITH user_totals AS (
      SELECT
        u.id,
        u.email,
        u.name,
        u."firstName"        AS "firstName",
        u."lastName"         AS "lastName",
        u."profilePhotoUrl"  AS "profilePhotoUrl",
        u."defaultLocation"  AS "defaultLocation",
        COUNT(sg.id)::int AS n
      FROM "User" u
      JOIN "Signup" sg ON sg."userId" = u.id
      JOIN "Shift"  sh ON sh.id = sg."shiftId"
      WHERE sg.status = 'CONFIRMED'::"SignupStatus"
        AND sh."end" < ${now}
        AND u.role = 'VOLUNTEER'::"Role"
        AND ${locMatch}
        ${locFilter}
      GROUP BY u.id
    ),
    filtered AS (
      SELECT *, n AS "totalShifts"
      FROM user_totals
      WHERE ${range}
    )
  `;

  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<BaseUserRow[]>`
      ${cte}
      SELECT * FROM filtered
      ORDER BY "totalShifts" DESC, name NULLS LAST
      LIMIT ${RESULT_CAP}
    `,
    prisma.$queryRaw<Array<{ total: bigint }>>`
      ${cte}
      SELECT COUNT(*)::bigint AS total FROM filtered
    `,
  ]);

  return {
    users: rows.map((row) => ({
      ...baseUser(row),
      monthlyRate: null,
      projectedMonths: null,
      achievedAt: null,
    })),
    total: Number(countRows[0]?.total ?? 0),
    cap: RESULT_CAP,
  };
}

async function getProjectionUsers(
  threshold: number,
  sixMonthsAgo: Date,
  now: Date,
  locMatch: Prisma.Sql,
  locFilter: Prisma.Sql
): Promise<MilestoneSegmentResult> {
  // Mirror the projection logic in getMilestoneData: rate over last 6 months,
  // not yet at threshold, projected within 12 months.
  const cte = Prisma.sql`
    WITH user_totals AS (
      SELECT
        u.id,
        u.email,
        u.name,
        u."firstName"        AS "firstName",
        u."lastName"         AS "lastName",
        u."profilePhotoUrl"  AS "profilePhotoUrl",
        u."defaultLocation"  AS "defaultLocation",
        COUNT(*)::int AS "totalShifts",
        COUNT(*) FILTER (WHERE sh."end" >= ${sixMonthsAgo})::int AS "recentShifts"
      FROM "User" u
      JOIN "Signup" sg ON sg."userId" = u.id
      JOIN "Shift"  sh ON sh.id = sg."shiftId"
      WHERE sg.status = 'CONFIRMED'::"SignupStatus"
        AND sh."end" < ${now}
        AND u.role = 'VOLUNTEER'::"Role"
        AND ${locMatch}
        ${locFilter}
      GROUP BY u.id
    ),
    filtered AS (
      SELECT *
      FROM user_totals
      WHERE "totalShifts" < ${threshold}
        AND "recentShifts" > 0
        AND (${threshold} - "totalShifts")::float / ("recentShifts"::float / 6) <= ${PROJECTION_MONTHS}
    )
  `;

  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<ProjectionRow[]>`
      ${cte}
      SELECT * FROM filtered
      ORDER BY "totalShifts" DESC, name NULLS LAST
      LIMIT ${RESULT_CAP}
    `,
    prisma.$queryRaw<Array<{ total: bigint }>>`
      ${cte}
      SELECT COUNT(*)::bigint AS total FROM filtered
    `,
  ]);

  return {
    users: rows.map((row) => {
      const monthlyRate = Number(row.recentShifts) / 6;
      const shiftsNeeded = threshold - Number(row.totalShifts);
      const projectedMonths =
        monthlyRate > 0 ? Math.ceil(shiftsNeeded / monthlyRate) : null;
      return {
        ...baseUser(row),
        monthlyRate: Math.round(monthlyRate * 10) / 10,
        projectedMonths,
        achievedAt: null,
      };
    }),
    total: Number(countRows[0]?.total ?? 0),
    cap: RESULT_CAP,
  };
}
