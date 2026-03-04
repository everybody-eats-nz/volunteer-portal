import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/client";

export type EngagementStatus = "highly_active" | "active" | "inactive" | "never";

/**
 * Classify a volunteer's engagement level based on their shift history.
 *
 * - "never": 0 completed shifts ever
 * - "inactive": has completed shifts, but none in the selected period
 * - "active": at least 1 shift in the period (but fewer than 2/month avg)
 * - "highly_active": averaging 2+ shifts per month in the period
 */
export function classifyEngagement(
  totalShifts: number,
  shiftsInPeriod: number,
  months: number
): EngagementStatus {
  if (totalShifts === 0) return "never";
  if (shiftsInPeriod === 0) return "inactive";
  const avgPerMonth = shiftsInPeriod / months;
  return avgPerMonth >= 2 ? "highly_active" : "active";
}

export interface EngagementSummaryData {
  summary: {
    totalVolunteers: number;
    activeCount: number;
    highlyActiveCount: number;
    inactiveCount: number;
    neverVolunteeredCount: number;
    retentionRate: number;
    newInPeriodCount: number;
  };
  monthlyTrend: Array<{
    month: string;
    activeVolunteers: number;
  }>;
  breakdown: Array<{
    label: string;
    value: number;
    color: string;
  }>;
}

export async function getEngagementSummary(
  months: number,
  location: string | null
): Promise<EngagementSummaryData> {
  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setMonth(periodStart.getMonth() - months);
  const priorStart = new Date(periodStart);
  priorStart.setMonth(priorStart.getMonth() - months);
  const trendStart = new Date(now);
  trendStart.setMonth(trendStart.getMonth() - 12);

  const isLocationFiltered = !!location && location !== "all";
  const locationCond = isLocationFiltered
    ? Prisma.sql`sh.location = ${location}`
    : Prisma.sql`TRUE`;
  const trendLocationCond = isLocationFiltered
    ? Prisma.sql`AND sh.location = ${location}`
    : Prisma.empty;
  // When location-filtered, only count volunteers with shifts at this location
  const excludeCond = isLocationFiltered
    ? Prisma.sql`total_shifts > 0`
    : Prisma.sql`TRUE`;
  const neverCond = isLocationFiltered
    ? Prisma.sql`FALSE`
    : Prisma.sql`all_completed = 0`;

  const safeMonths = Math.max(months, 1);

  const [summaryResult, trendResult] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        totalVolunteers: bigint;
        activeCount: bigint;
        highlyActiveCount: bigint;
        inactiveCount: bigint;
        neverVolunteeredCount: bigint;
        priorActiveCount: bigint;
        retainedCount: bigint;
        newInPeriodCount: bigint;
      }>
    >`
      WITH volunteer_stats AS (
        SELECT
          u.id,
          COALESCE(COUNT(sg.id) FILTER (WHERE sh."end" < ${now}), 0) as all_completed,
          COALESCE(COUNT(sg.id) FILTER (WHERE sh."end" < ${now} AND ${locationCond}), 0) as total_shifts,
          COALESCE(COUNT(sg.id) FILTER (WHERE sh."end" >= ${periodStart} AND sh."end" < ${now} AND ${locationCond}), 0) as shifts_in_period,
          MIN(sh."end") FILTER (WHERE sh."end" < ${now} AND ${locationCond}) as first_shift_date,
          BOOL_OR(sh."end" >= ${priorStart} AND sh."end" < ${periodStart} AND ${locationCond}) as in_prior_period,
          BOOL_OR(sh."end" >= ${periodStart} AND sh."end" < ${now} AND ${locationCond}) as in_current_period
        FROM "User" u
        LEFT JOIN "Signup" sg ON sg."userId" = u.id AND sg.status = 'CONFIRMED'
        LEFT JOIN "Shift" sh ON sh.id = sg."shiftId"
        WHERE u.role = 'VOLUNTEER'::"Role"
        GROUP BY u.id
      )
      SELECT
        COUNT(*) FILTER (WHERE ${excludeCond})::bigint as "totalVolunteers",
        COUNT(*) FILTER (WHERE total_shifts > 0 AND shifts_in_period > 0 AND shifts_in_period::float / ${safeMonths} < 2)::bigint as "activeCount",
        COUNT(*) FILTER (WHERE total_shifts > 0 AND shifts_in_period::float / ${safeMonths} >= 2)::bigint as "highlyActiveCount",
        COUNT(*) FILTER (WHERE total_shifts > 0 AND shifts_in_period = 0)::bigint as "inactiveCount",
        COUNT(*) FILTER (WHERE ${neverCond})::bigint as "neverVolunteeredCount",
        COUNT(*) FILTER (WHERE in_prior_period IS TRUE)::bigint as "priorActiveCount",
        COUNT(*) FILTER (WHERE in_prior_period IS TRUE AND in_current_period IS TRUE)::bigint as "retainedCount",
        COUNT(*) FILTER (WHERE shifts_in_period > 0 AND first_shift_date >= ${periodStart})::bigint as "newInPeriodCount"
      FROM volunteer_stats
    `,
    prisma.$queryRaw<Array<{ month: string; activeVolunteers: bigint }>>`
      SELECT
        to_char(date_trunc('month', sh."end"), 'YYYY-MM') as month,
        COUNT(DISTINCT sg."userId")::bigint as "activeVolunteers"
      FROM "Signup" sg
      JOIN "Shift" sh ON sh.id = sg."shiftId"
      WHERE sg.status = 'CONFIRMED'
        AND sh."end" < ${now}
        AND sh."end" >= ${trendStart}
        ${trendLocationCond}
      GROUP BY date_trunc('month', sh."end")
      ORDER BY month
    `,
  ]);

  const summary = summaryResult[0];
  const activeCount = Number(summary?.activeCount || 0);
  const highlyActiveCount = Number(summary?.highlyActiveCount || 0);
  const inactiveCount = Number(summary?.inactiveCount || 0);
  const neverVolunteeredCount = Number(summary?.neverVolunteeredCount || 0);
  const priorActiveCount = Number(summary?.priorActiveCount || 0);
  const retainedCount = Number(summary?.retainedCount || 0);
  const newInPeriodCount = Number(summary?.newInPeriodCount || 0);
  const totalVolunteers = Number(summary?.totalVolunteers || 0);

  const retentionRate =
    priorActiveCount > 0
      ? Math.round((retainedCount / priorActiveCount) * 100)
      : 0;

  // Fill in monthly trend with all 12 months (including months with 0 activity)
  const trendMap = new Map(
    trendResult.map((r) => [r.month, Number(r.activeVolunteers)])
  );
  const monthlyTrend = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyTrend.push({
      month: key,
      activeVolunteers: trendMap.get(key) || 0,
    });
  }

  return {
    summary: {
      totalVolunteers,
      activeCount,
      highlyActiveCount,
      inactiveCount,
      neverVolunteeredCount,
      retentionRate,
      newInPeriodCount,
    },
    monthlyTrend,
    breakdown: [
      { label: "Highly Active", value: highlyActiveCount, color: "#10b981" },
      { label: "Active", value: activeCount, color: "#3b82f6" },
      { label: "Inactive", value: inactiveCount, color: "#f59e0b" },
      {
        label: "Never Volunteered",
        value: neverVolunteeredCount,
        color: "#ef4444",
      },
    ],
  };
}

// --- Volunteer table ---

export interface EngagementVolunteerRow {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  profilePhotoUrl: string | null;
  volunteerGrade: string;
  createdAt: string;
  lastShiftDate: string | null;
  totalShifts: number;
  shiftsInPeriod: number;
  engagementStatus: EngagementStatus;
}

export interface EngagementVolunteersResult {
  volunteers: EngagementVolunteerRow[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

export async function getEngagementVolunteers(params: {
  months: number;
  location: string | null;
  statusFilter: string | null;
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
  search: string;
}): Promise<EngagementVolunteersResult> {
  const {
    months,
    location,
    statusFilter,
    page,
    pageSize,
    sortBy,
    sortOrder,
    search,
  } = params;

  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setMonth(periodStart.getMonth() - months);

  const isLocationFiltered = !!location && location !== "all";
  const locationCond = isLocationFiltered
    ? Prisma.sql`sh.location = ${location}`
    : Prisma.sql`TRUE`;

  const searchCond = search
    ? Prisma.sql`AND (
        LOWER(u.name) LIKE ${`%${search.toLowerCase()}%`}
        OR LOWER(u."firstName") LIKE ${`%${search.toLowerCase()}%`}
        OR LOWER(u."lastName") LIKE ${`%${search.toLowerCase()}%`}
        OR LOWER(u.email) LIKE ${`%${search.toLowerCase()}%`}
      )`
    : Prisma.empty;

  // When location-filtered, skip all volunteers with 0 shifts at this location
  const skipCond = isLocationFiltered
    ? Prisma.sql`total_shifts = 0`
    : Prisma.sql`FALSE`;

  const statusCond =
    statusFilter && statusFilter !== "all"
      ? Prisma.sql`AND engagement_status = ${statusFilter}`
      : Prisma.empty;

  // Validate sort column to prevent SQL injection
  const sortColumnMap: Record<string, string> = {
    user: `COALESCE(name, CONCAT("firstName", ' ', "lastName"), email)`,
    totalShifts: `total_shifts`,
    shiftsInPeriod: `shifts_in_period`,
    lastShiftDate: `last_shift_date`,
  };
  const orderCol = sortColumnMap[sortBy] || `last_shift_date`;
  const orderDir = sortOrder === "asc" ? "ASC" : "DESC";
  const nullsOrder = `NULLS ${sortOrder === "asc" ? "FIRST" : "LAST"}`;

  const offset = (page - 1) * pageSize;
  const safeMonths = Math.max(months, 1);

  const statsCTE = Prisma.sql`
    WITH raw_stats AS (
      SELECT
        u.id, u.name, u."firstName", u."lastName", u.email,
        u."profilePhotoUrl", u."volunteerGrade", u."createdAt",
        COALESCE(COUNT(sg.id) FILTER (WHERE sh."end" < ${now}), 0) as all_completed,
        COALESCE(COUNT(sg.id) FILTER (WHERE sh."end" < ${now} AND ${locationCond}), 0) as total_shifts,
        COALESCE(COUNT(sg.id) FILTER (WHERE sh."end" >= ${periodStart} AND sh."end" < ${now} AND ${locationCond}), 0) as shifts_in_period,
        MAX(sh."end") FILTER (WHERE sh."end" < ${now} AND ${locationCond}) as last_shift_date
      FROM "User" u
      LEFT JOIN "Signup" sg ON sg."userId" = u.id AND sg.status = 'CONFIRMED'
      LEFT JOIN "Shift" sh ON sh.id = sg."shiftId"
      WHERE u.role = 'VOLUNTEER'::"Role"
        ${searchCond}
      GROUP BY u.id, u.name, u."firstName", u."lastName", u.email,
        u."profilePhotoUrl", u."volunteerGrade", u."createdAt"
    ),
    volunteer_stats AS (
      SELECT *,
        CASE
          WHEN ${skipCond} THEN 'skip'
          WHEN total_shifts = 0 THEN 'never'
          WHEN shifts_in_period = 0 THEN 'inactive'
          WHEN shifts_in_period::float / ${safeMonths} >= 2 THEN 'highly_active'
          ELSE 'active'
        END as engagement_status
      FROM raw_stats
    )
  `;

  const filterCond = Prisma.sql`
    WHERE engagement_status != 'skip'
      ${statusCond}
  `;

  const [countResult, dataResult] = await Promise.all([
    prisma.$queryRaw<[{ count: bigint }]>`
      ${statsCTE}
      SELECT COUNT(*)::bigint as count
      FROM volunteer_stats
      ${filterCond}
    `,
    prisma.$queryRaw<
      Array<{
        id: string;
        name: string | null;
        firstName: string | null;
        lastName: string | null;
        email: string;
        profilePhotoUrl: string | null;
        volunteerGrade: string;
        createdAt: Date;
        total_shifts: bigint;
        shifts_in_period: bigint;
        last_shift_date: Date | null;
        engagement_status: string;
      }>
    >`
      ${statsCTE}
      SELECT id, name, "firstName", "lastName", email, "profilePhotoUrl",
        "volunteerGrade", "createdAt",
        total_shifts, shifts_in_period, last_shift_date, engagement_status
      FROM volunteer_stats
      ${filterCond}
      ORDER BY ${Prisma.raw(`${orderCol} ${orderDir} ${nullsOrder}`)}
      LIMIT ${pageSize} OFFSET ${offset}
    `,
  ]);

  const totalCount = Number(countResult[0]?.count || 0);
  const totalPages = Math.ceil(totalCount / pageSize);

  const volunteers: EngagementVolunteerRow[] = dataResult.map((r) => ({
    id: r.id,
    name: r.name,
    firstName: r.firstName,
    lastName: r.lastName,
    email: r.email,
    profilePhotoUrl: r.profilePhotoUrl,
    volunteerGrade: r.volunteerGrade,
    createdAt: r.createdAt.toISOString(),
    lastShiftDate: r.last_shift_date?.toISOString() || null,
    totalShifts: Number(r.total_shifts),
    shiftsInPeriod: Number(r.shifts_in_period),
    engagementStatus: r.engagement_status as EngagementStatus,
  }));

  return {
    volunteers,
    pagination: { page, pageSize, totalCount, totalPages },
  };
}
