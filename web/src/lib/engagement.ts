import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/client";
import { shiftStartNZ } from "@/lib/concurrent-shifts";
import { differenceInMonths } from "date-fns";

export type EngagementStatus = "highly_active" | "active" | "inactive" | "never";

/**
 * Months of inactivity before a returning volunteer counts as "reactivated".
 * @see getEngagementSummary
 */
export const REACTIVATION_GAP_MONTHS = 6;

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
    reactivatedCount: number;
  };
  monthlyTrend: Array<{
    month: string;
    activeVolunteers: number;
  }>;
  breakdown: Array<{
    label: string;
    value: number;
    prevValue: number;
    color: string;
  }>;
}

export async function getEngagementSummary(
  months: number,
  location: string | null,
  daysFilter: number[] | null = null
): Promise<EngagementSummaryData> {
  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setMonth(periodStart.getMonth() - months);
  const priorStart = new Date(periodStart);
  priorStart.setMonth(priorStart.getMonth() - months);
  const trendStart = new Date(now);
  trendStart.setMonth(trendStart.getMonth() - 24);

  const isLocationFiltered = !!location && location !== "all";
  const locationCond = isLocationFiltered
    ? Prisma.sql`sh.location = ${location}`
    : Prisma.sql`TRUE`;
  const trendLocationCond = isLocationFiltered
    ? Prisma.sql`AND sh.location = ${location}`
    : Prisma.empty;
  const daysCond = daysFilter && daysFilter.length > 0
    ? Prisma.sql`AND EXTRACT(DOW FROM ${shiftStartNZ()})::int IN (${Prisma.join(daysFilter)})`
    : Prisma.empty;
  // When location-filtered, include volunteers with shifts at this location
  // OR who selected this location as their default (for "never volunteered")
  const excludeCond = isLocationFiltered
    ? Prisma.sql`(total_shifts > 0 OR (all_completed = 0 AND has_default_location))`
    : Prisma.sql`TRUE`;
  const neverCond = isLocationFiltered
    ? Prisma.sql`all_completed = 0 AND has_default_location`
    : Prisma.sql`all_completed = 0`;

  const safeMonths = Math.max(months, 1);

  // A volunteer counts as "reactivated" if they completed a shift in the
  // period after a quiet gap of at least this many months immediately before
  // their first shift back — and they had volunteered before that gap (so
  // brand-new volunteers are excluded).
  const reactivationGap = Prisma.sql`INTERVAL '${Prisma.raw(
    String(REACTIVATION_GAP_MONTHS)
  )} months'`;
  // Per-shift-alias location/day filters for the reactivation subqueries.
  const aliasConds = (alias: string) => {
    const loc = isLocationFiltered
      ? Prisma.sql`AND ${Prisma.raw(alias)}.location = ${location}`
      : Prisma.empty;
    const dys =
      daysFilter && daysFilter.length > 0
        ? Prisma.sql`AND EXTRACT(DOW FROM ${shiftStartNZ(
            `${alias}.start`
          )})::int IN (${Prisma.join(daysFilter)})`
        : Prisma.empty;
    return { loc, dys };
  };
  const fp = aliasConds("shf");
  const gp = aliasConds("shg");
  const pp = aliasConds("shp");

  const [summaryResult, trendResult, reactivationResult] = await Promise.all([
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
        prevHighlyActiveCount: bigint;
        prevActiveCount: bigint;
        prevInactiveCount: bigint;
        prevNeverCount: bigint;
      }>
    >`
      WITH volunteer_stats AS (
        SELECT
          u.id,
          COALESCE(COUNT(sg.id) FILTER (WHERE sh."end" < ${now}), 0) as all_completed,
          COALESCE(COUNT(sg.id) FILTER (WHERE sh."end" < ${now} AND ${locationCond} ${daysCond}), 0) as total_shifts,
          COALESCE(COUNT(sg.id) FILTER (WHERE sh."end" >= ${periodStart} AND sh."end" < ${now} AND ${locationCond} ${daysCond}), 0) as shifts_in_period,
          COALESCE(COUNT(sg.id) FILTER (WHERE sh."end" >= ${priorStart} AND sh."end" < ${periodStart} AND ${locationCond} ${daysCond}), 0) as shifts_in_prior,
          MIN(sh."end") FILTER (WHERE sh."end" < ${now} AND ${locationCond} ${daysCond}) as first_shift_date,
          BOOL_OR(sh."end" >= ${priorStart} AND sh."end" < ${periodStart} AND ${locationCond} ${daysCond}) as in_prior_period,
          BOOL_OR(sh."end" >= ${periodStart} AND sh."end" < ${now} AND ${locationCond} ${daysCond}) as in_current_period,
          CASE
            WHEN u."defaultLocation" = ${location || ''}
            THEN TRUE
            ELSE FALSE
          END as has_default_location
        FROM "User" u
        LEFT JOIN "Signup" sg ON sg."userId" = u.id AND sg.status = 'CONFIRMED'
        LEFT JOIN "Shift" sh ON sh.id = sg."shiftId"
        WHERE u.role = 'VOLUNTEER'::"Role"
        GROUP BY u.id, u."defaultLocation"
      )
      SELECT
        COUNT(*) FILTER (WHERE ${excludeCond})::bigint as "totalVolunteers",
        COUNT(*) FILTER (WHERE total_shifts > 0 AND shifts_in_period > 0 AND shifts_in_period::float / ${safeMonths} < 2)::bigint as "activeCount",
        COUNT(*) FILTER (WHERE total_shifts > 0 AND shifts_in_period::float / ${safeMonths} >= 2)::bigint as "highlyActiveCount",
        COUNT(*) FILTER (WHERE total_shifts > 0 AND shifts_in_period = 0)::bigint as "inactiveCount",
        COUNT(*) FILTER (WHERE ${neverCond})::bigint as "neverVolunteeredCount",
        COUNT(*) FILTER (WHERE in_prior_period IS TRUE)::bigint as "priorActiveCount",
        COUNT(*) FILTER (WHERE in_prior_period IS TRUE AND in_current_period IS TRUE)::bigint as "retainedCount",
        COUNT(*) FILTER (WHERE shifts_in_period > 0 AND first_shift_date >= ${periodStart})::bigint as "newInPeriodCount",
        COUNT(*) FILTER (WHERE total_shifts > 0 AND shifts_in_prior::float / ${safeMonths} >= 2)::bigint as "prevHighlyActiveCount",
        COUNT(*) FILTER (WHERE total_shifts > 0 AND shifts_in_prior > 0 AND shifts_in_prior::float / ${safeMonths} < 2)::bigint as "prevActiveCount",
        COUNT(*) FILTER (WHERE total_shifts > 0 AND shifts_in_prior = 0)::bigint as "prevInactiveCount",
        COUNT(*) FILTER (WHERE ${neverCond})::bigint as "prevNeverCount"
      FROM volunteer_stats
    `,
    prisma.$queryRaw<Array<{ month: string; activeVolunteers: bigint }>>`
      SELECT
        to_char(date_trunc('week', sh."end"), 'YYYY-MM-DD') as month,
        COUNT(DISTINCT sg."userId")::bigint as "activeVolunteers"
      FROM "Signup" sg
      JOIN "Shift" sh ON sh.id = sg."shiftId"
      WHERE sg.status = 'CONFIRMED'
        AND sh."end" < ${now}
        AND sh."end" >= ${trendStart}
        ${trendLocationCond}
        ${daysCond}
      GROUP BY date_trunc('week', sh."end")
      ORDER BY month
    `,
    prisma.$queryRaw<Array<{ reactivatedCount: bigint }>>`
      WITH first_in_period AS (
        SELECT
          sg."userId" AS user_id,
          MIN(shf."end") AS first_end
        FROM "Signup" sg
        JOIN "Shift" shf ON shf.id = sg."shiftId"
        JOIN "User" u ON u.id = sg."userId"
        WHERE sg.status = 'CONFIRMED'
          AND u.role = 'VOLUNTEER'::"Role"
          AND shf."end" >= ${periodStart}
          AND shf."end" < ${now}
          ${fp.loc}
          ${fp.dys}
        GROUP BY sg."userId"
      )
      SELECT COUNT(*)::bigint AS "reactivatedCount"
      FROM first_in_period f
      WHERE NOT EXISTS (
              SELECT 1
              FROM "Signup" sg2
              JOIN "Shift" shg ON shg.id = sg2."shiftId"
              WHERE sg2."userId" = f.user_id
                AND sg2.status = 'CONFIRMED'
                AND shg."end" >= (f.first_end - ${reactivationGap})
                AND shg."end" < f.first_end
                ${gp.loc}
                ${gp.dys}
            )
        AND EXISTS (
              SELECT 1
              FROM "Signup" sg3
              JOIN "Shift" shp ON shp.id = sg3."shiftId"
              WHERE sg3."userId" = f.user_id
                AND sg3.status = 'CONFIRMED'
                AND shp."end" < (f.first_end - ${reactivationGap})
                ${pp.loc}
                ${pp.dys}
            )
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
  const reactivatedCount = Number(reactivationResult[0]?.reactivatedCount || 0);
  const totalVolunteers = Number(summary?.totalVolunteers || 0);
  const prevHighlyActiveCount = Number(summary?.prevHighlyActiveCount || 0);
  const prevActiveCount = Number(summary?.prevActiveCount || 0);
  const prevInactiveCount = Number(summary?.prevInactiveCount || 0);
  const prevNeverCount = Number(summary?.prevNeverCount || 0);

  const retentionRate =
    priorActiveCount > 0
      ? Math.round((retainedCount / priorActiveCount) * 100)
      : 0;

  // Fill in weekly trend with 104 weeks (including weeks with 0 activity)
  const trendMap = new Map(
    trendResult.map((r) => [r.month, Number(r.activeVolunteers)])
  );
  const currentMonday = new Date(now);
  const dayOfWeek = currentMonday.getDay();
  currentMonday.setDate(
    currentMonday.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)
  );
  currentMonday.setHours(0, 0, 0, 0);
  const monthlyTrend = [];
  for (let i = 103; i >= 0; i--) {
    const d = new Date(currentMonday);
    d.setDate(d.getDate() - i * 7);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
      reactivatedCount,
    },
    monthlyTrend,
    breakdown: [
      { label: "Highly Active", value: highlyActiveCount, prevValue: prevHighlyActiveCount, color: "#10b981" },
      { label: "Active", value: activeCount, prevValue: prevActiveCount, color: "#3b82f6" },
      { label: "Inactive", value: inactiveCount, prevValue: prevInactiveCount, color: "#f59e0b" },
      {
        label: "Never Volunteered",
        value: neverVolunteeredCount,
        prevValue: prevNeverCount,
        color: "#ef4444",
      },
    ],
  };
}

// --- Reactivated volunteers drill-down ---

/** Max rows returned by the reactivated-volunteers list (safety cap). */
export const REACTIVATED_RESULT_CAP = 500;

/** A single reactivated volunteer for the drill-down list. */
export interface ReactivatedVolunteer {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  profilePhotoUrl: string | null;
  defaultLocation: string | null;
  /** Total completed (CONFIRMED, past) shifts, all-time. */
  totalShifts: number;
  /** ISO date of their first shift back in the period. */
  firstBack: string;
  /** ISO date of their most recent shift before the inactivity gap. */
  lastBefore: string | null;
  /** Whole months between lastBefore and firstBack (the gap length). */
  monthsAway: number | null;
}

export interface ReactivatedVolunteersResult {
  users: ReactivatedVolunteer[];
  total: number;
  cap: number;
}

interface ReactivatedRow {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  profilePhotoUrl: string | null;
  defaultLocation: string | null;
  totalShifts: bigint;
  firstBack: Date;
  lastBefore: Date | null;
  total: bigint;
}

/**
 * The list behind the "Reactivated" KPI on the engagement report — the actual
 * volunteers who returned in the period after a {@link REACTIVATION_GAP_MONTHS}
 * month gap (and who had volunteered before that gap). Mirrors the count logic
 * in {@link getEngagementSummary} so the list and the KPI always agree.
 */
export async function getReactivatedVolunteers(
  months: number,
  location: string | null,
  daysFilter: number[] | null = null
): Promise<ReactivatedVolunteersResult> {
  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setMonth(periodStart.getMonth() - months);

  const isLocationFiltered = !!location && location !== "all";
  const reactivationGap = Prisma.sql`INTERVAL '${Prisma.raw(
    String(REACTIVATION_GAP_MONTHS)
  )} months'`;
  const aliasConds = (alias: string) => {
    const loc = isLocationFiltered
      ? Prisma.sql`AND ${Prisma.raw(alias)}.location = ${location}`
      : Prisma.empty;
    const dys =
      daysFilter && daysFilter.length > 0
        ? Prisma.sql`AND EXTRACT(DOW FROM ${shiftStartNZ(
            `${alias}.start`
          )})::int IN (${Prisma.join(daysFilter)})`
        : Prisma.empty;
    return { loc, dys };
  };
  const fp = aliasConds("shf");
  const gp = aliasConds("shg");
  const pp = aliasConds("shp");
  const bp = aliasConds("shb");
  const tp = aliasConds("sht");

  const rows = await prisma.$queryRaw<ReactivatedRow[]>`
    WITH first_in_period AS (
      SELECT sg."userId" AS user_id, MIN(shf."end") AS first_end
      FROM "Signup" sg
      JOIN "Shift" shf ON shf.id = sg."shiftId"
      JOIN "User" u ON u.id = sg."userId"
      WHERE sg.status = 'CONFIRMED'
        AND u.role = 'VOLUNTEER'::"Role"
        AND shf."end" >= ${periodStart}
        AND shf."end" < ${now}
        ${fp.loc}
        ${fp.dys}
      GROUP BY sg."userId"
    ),
    reactivated AS (
      SELECT f.user_id, f.first_end
      FROM first_in_period f
      WHERE NOT EXISTS (
              SELECT 1 FROM "Signup" sg2
              JOIN "Shift" shg ON shg.id = sg2."shiftId"
              WHERE sg2."userId" = f.user_id
                AND sg2.status = 'CONFIRMED'
                AND shg."end" >= (f.first_end - ${reactivationGap})
                AND shg."end" < f.first_end
                ${gp.loc}
                ${gp.dys}
            )
        AND EXISTS (
              SELECT 1 FROM "Signup" sg3
              JOIN "Shift" shp ON shp.id = sg3."shiftId"
              WHERE sg3."userId" = f.user_id
                AND sg3.status = 'CONFIRMED'
                AND shp."end" < (f.first_end - ${reactivationGap})
                ${pp.loc}
                ${pp.dys}
            )
    )
    SELECT
      u.id,
      u.email,
      u.name,
      u."firstName",
      u."lastName",
      u."profilePhotoUrl",
      u."defaultLocation",
      r.first_end AS "firstBack",
      (
        SELECT MAX(shb."end")
        FROM "Signup" sgb
        JOIN "Shift" shb ON shb.id = sgb."shiftId"
        WHERE sgb."userId" = r.user_id
          AND sgb.status = 'CONFIRMED'
          AND shb."end" < (r.first_end - ${reactivationGap})
          ${bp.loc}
          ${bp.dys}
      ) AS "lastBefore",
      (
        SELECT COUNT(*)
        FROM "Signup" sgt
        JOIN "Shift" sht ON sht.id = sgt."shiftId"
        WHERE sgt."userId" = r.user_id
          AND sgt.status = 'CONFIRMED'
          AND sht."end" < ${now}
          ${tp.loc}
          ${tp.dys}
      )::bigint AS "totalShifts",
      COUNT(*) OVER ()::bigint AS total
    FROM reactivated r
    JOIN "User" u ON u.id = r.user_id
    ORDER BY r.first_end DESC
    LIMIT ${REACTIVATED_RESULT_CAP}
  `;

  const users: ReactivatedVolunteer[] = rows.map((r) => {
    const firstBack = r.firstBack;
    const lastBefore = r.lastBefore;
    const monthsAway =
      lastBefore != null
        ? Math.max(0, differenceInMonths(firstBack, lastBefore))
        : null;
    return {
      id: r.id,
      email: r.email,
      name: r.name,
      firstName: r.firstName,
      lastName: r.lastName,
      profilePhotoUrl: r.profilePhotoUrl,
      defaultLocation: r.defaultLocation,
      totalShifts: Number(r.totalShifts),
      firstBack: firstBack.toISOString(),
      lastBefore: lastBefore ? lastBefore.toISOString() : null,
      monthsAway,
    };
  });

  return {
    users,
    total: rows.length > 0 ? Number(rows[0].total) : 0,
    cap: REACTIVATED_RESULT_CAP,
  };
}

// --- Generic stat-card drill-down ---

/** The clickable engagement stat cards, each backed by a drill-down list. */
export type EngagementSegment =
  | "total"
  | "highly_active"
  | "active"
  | "inactive"
  | "never"
  | "new"
  | "retention"
  | "reactivated";

export const ENGAGEMENT_SEGMENTS: readonly EngagementSegment[] = [
  "total",
  "highly_active",
  "active",
  "inactive",
  "never",
  "new",
  "retention",
  "reactivated",
] as const;

/** A volunteer row in any segment drill-down. */
export interface EngagementSegmentVolunteer {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  profilePhotoUrl: string | null;
  defaultLocation: string | null;
  totalShifts: number;
  shiftsInPeriod: number;
  lastShiftDate: string | null;
  // Reactivated-only extras (null for other segments).
  firstBack: string | null;
  lastBefore: string | null;
  monthsAway: number | null;
}

export interface EngagementSegmentResult {
  segment: EngagementSegment;
  users: EngagementSegmentVolunteer[];
  total: number;
  cap: number;
}

const SEGMENT_RESULT_CAP = 500;

interface SegmentRow {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  profilePhotoUrl: string | null;
  defaultLocation: string | null;
  totalShifts: bigint;
  shiftsInPeriod: bigint;
  lastShiftDate: Date | null;
  total: bigint;
}

/**
 * The volunteers behind a single engagement stat card. Mirrors the
 * classification used by {@link getEngagementVolunteers} (the on-page table)
 * so the lists stay consistent, and reuses {@link getReactivatedVolunteers}
 * for the reactivated segment. Capped at {@link SEGMENT_RESULT_CAP} rows.
 */
export async function getEngagementSegmentVolunteers(
  segment: EngagementSegment,
  months: number,
  location: string | null,
  daysFilter: number[] | null = null
): Promise<EngagementSegmentResult> {
  if (segment === "reactivated") {
    const r = await getReactivatedVolunteers(months, location, daysFilter);
    return {
      segment,
      users: r.users.map((u) => ({
        ...u,
        shiftsInPeriod: 0,
        lastShiftDate: u.firstBack,
      })),
      total: r.total,
      cap: r.cap,
    };
  }

  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setMonth(periodStart.getMonth() - months);
  const priorStart = new Date(periodStart);
  priorStart.setMonth(priorStart.getMonth() - months);
  const safeMonths = Math.max(months, 1);

  const isLocationFiltered = !!location && location !== "all";
  const locationCond = isLocationFiltered
    ? Prisma.sql`sh.location = ${location}`
    : Prisma.sql`TRUE`;
  const daysCond =
    daysFilter && daysFilter.length > 0
      ? Prisma.sql`AND EXTRACT(DOW FROM ${shiftStartNZ()})::int IN (${Prisma.join(
          daysFilter
        )})`
      : Prisma.empty;
  const skipCond = isLocationFiltered
    ? Prisma.sql`total_shifts = 0 AND NOT has_default_location`
    : Prisma.sql`FALSE`;

  // Per-segment row filter applied on top of the shared classification.
  const segmentCond = (() => {
    switch (segment) {
      case "total":
        return Prisma.sql`TRUE`;
      case "highly_active":
      case "active":
      case "inactive":
      case "never":
        return Prisma.sql`engagement_status = ${segment}`;
      case "new":
        return Prisma.sql`shifts_in_period > 0 AND first_shift_date >= ${periodStart}`;
      case "retention":
        return Prisma.sql`in_prior IS TRUE AND in_current IS TRUE`;
    }
  })();

  const rows = await prisma.$queryRaw<SegmentRow[]>`
    WITH raw_stats AS (
      SELECT
        u.id, u.email, u.name, u."firstName", u."lastName",
        u."profilePhotoUrl", u."defaultLocation",
        COALESCE(COUNT(sg.id) FILTER (WHERE sh."end" < ${now} AND ${locationCond} ${daysCond}), 0) AS total_shifts,
        COALESCE(COUNT(sg.id) FILTER (WHERE sh."end" >= ${periodStart} AND sh."end" < ${now} AND ${locationCond} ${daysCond}), 0) AS shifts_in_period,
        MIN(sh."end") FILTER (WHERE sh."end" < ${now} AND ${locationCond} ${daysCond}) AS first_shift_date,
        MAX(sh."end") FILTER (WHERE sh."end" < ${now} AND ${locationCond} ${daysCond}) AS last_shift_date,
        BOOL_OR(sh."end" >= ${priorStart} AND sh."end" < ${periodStart} AND ${locationCond} ${daysCond}) AS in_prior,
        BOOL_OR(sh."end" >= ${periodStart} AND sh."end" < ${now} AND ${locationCond} ${daysCond}) AS in_current,
        CASE WHEN u."defaultLocation" = ${location || ""} THEN TRUE ELSE FALSE END AS has_default_location
      FROM "User" u
      LEFT JOIN "Signup" sg ON sg."userId" = u.id AND sg.status = 'CONFIRMED'
      LEFT JOIN "Shift" sh ON sh.id = sg."shiftId"
      WHERE u.role = 'VOLUNTEER'::"Role"
      GROUP BY u.id, u.email, u.name, u."firstName", u."lastName",
        u."profilePhotoUrl", u."defaultLocation"
    ),
    stats AS (
      SELECT *,
        CASE
          WHEN ${skipCond} THEN 'skip'
          WHEN total_shifts = 0 THEN 'never'
          WHEN shifts_in_period = 0 THEN 'inactive'
          WHEN shifts_in_period::float / ${safeMonths} >= 2 THEN 'highly_active'
          ELSE 'active'
        END AS engagement_status
      FROM raw_stats
    )
    SELECT
      id, email, name, "firstName", "lastName", "profilePhotoUrl", "defaultLocation",
      total_shifts AS "totalShifts",
      shifts_in_period AS "shiftsInPeriod",
      last_shift_date AS "lastShiftDate",
      COUNT(*) OVER ()::bigint AS total
    FROM stats
    WHERE engagement_status != 'skip'
      AND ${segmentCond}
    ORDER BY last_shift_date DESC NULLS LAST,
      COALESCE(name, CONCAT("firstName", ' ', "lastName"), email) ASC
    LIMIT ${SEGMENT_RESULT_CAP}
  `;

  const users: EngagementSegmentVolunteer[] = rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    firstName: r.firstName,
    lastName: r.lastName,
    profilePhotoUrl: r.profilePhotoUrl,
    defaultLocation: r.defaultLocation,
    totalShifts: Number(r.totalShifts),
    shiftsInPeriod: Number(r.shiftsInPeriod),
    lastShiftDate: r.lastShiftDate ? r.lastShiftDate.toISOString() : null,
    firstBack: null,
    lastBefore: null,
    monthsAway: null,
  }));

  return {
    segment,
    users,
    total: rows.length > 0 ? Number(rows[0].total) : 0,
    cap: SEGMENT_RESULT_CAP,
  };
}

// --- Shift type breakdown ---

export interface ShiftTypeEngagement {
  shiftTypeName: string;
  highlyActive: number;
  active: number;
  prevTotal: number;
}

export async function getEngagementByShiftType(
  months: number,
  location: string | null,
  daysFilter: number[] | null = null
): Promise<ShiftTypeEngagement[]> {
  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setMonth(periodStart.getMonth() - months);
  const priorStart = new Date(periodStart);
  priorStart.setMonth(priorStart.getMonth() - months);
  const safeMonths = Math.max(months, 1);

  const isLocationFiltered = !!location && location !== "all";
  const locationCond = isLocationFiltered
    ? Prisma.sql`AND sh.location = ${location}`
    : Prisma.empty;
  const daysCond = daysFilter && daysFilter.length > 0
    ? Prisma.sql`AND EXTRACT(DOW FROM ${shiftStartNZ()})::int IN (${Prisma.join(daysFilter)})`
    : Prisma.empty;

  const result = await prisma.$queryRaw<
    Array<{
      shiftTypeName: string;
      highlyActive: bigint;
      active: bigint;
      prevTotal: bigint;
    }>
  >`
    WITH per_volunteer_type AS (
      SELECT
        st.name as shift_type_name,
        sg."userId",
        COUNT(sg.id) FILTER (WHERE sh."end" >= ${periodStart} AND sh."end" < ${now}) as shifts_in_period,
        COUNT(sg.id) FILTER (WHERE sh."end" >= ${priorStart} AND sh."end" < ${periodStart}) as shifts_in_prior
      FROM "Signup" sg
      JOIN "Shift" sh ON sh.id = sg."shiftId"
      JOIN "ShiftType" st ON st.id = sh."shiftTypeId"
      WHERE sg.status = 'CONFIRMED'
        AND sh."end" >= ${priorStart}
        AND sh."end" < ${now}
        ${locationCond}
        ${daysCond}
      GROUP BY st.name, sg."userId"
    )
    SELECT
      shift_type_name as "shiftTypeName",
      COUNT(*) FILTER (WHERE shifts_in_period::float / ${safeMonths} >= 2)::bigint as "highlyActive",
      COUNT(*) FILTER (WHERE shifts_in_period > 0 AND shifts_in_period::float / ${safeMonths} < 2)::bigint as "active",
      COUNT(*) FILTER (WHERE shifts_in_prior > 0)::bigint as "prevTotal"
    FROM per_volunteer_type
    GROUP BY shift_type_name
    ORDER BY (COUNT(*) FILTER (WHERE shifts_in_period > 0)) DESC
  `;

  return result.map((r) => ({
    shiftTypeName: r.shiftTypeName,
    highlyActive: Number(r.highlyActive),
    active: Number(r.active),
    prevTotal: Number(r.prevTotal),
  }));
}

// --- Retention heatmap ---

export interface RetentionHeatmapData {
  cohorts: Array<{
    label: string;
    size: number;
    retention: (number | null)[];
  }>;
  maxMonths: number;
}

export async function getRetentionHeatmap(
  location: string | null,
  daysFilter: number[] | null = null
): Promise<RetentionHeatmapData> {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - 12);
  // Align to 1st of that month
  cutoff.setDate(1);
  cutoff.setHours(0, 0, 0, 0);

  const isLocationFiltered = !!location && location !== "all";
  const locationCond = isLocationFiltered
    ? Prisma.sql`AND sh.location = ${location}`
    : Prisma.empty;
  const daysCond = daysFilter && daysFilter.length > 0
    ? Prisma.sql`AND EXTRACT(DOW FROM ${shiftStartNZ()})::int IN (${Prisma.join(daysFilter)})`
    : Prisma.empty;

  const result = await prisma.$queryRaw<
    Array<{
      cohortMonth: Date;
      cohortSize: bigint;
      monthsSince: number;
      activeCount: bigint;
    }>
  >`
    WITH volunteer_cohorts AS (
      SELECT
        sg."userId",
        date_trunc('month', MIN(sh."end")) AS cohort_month
      FROM "Signup" sg
      JOIN "Shift" sh ON sh.id = sg."shiftId"
      WHERE sg.status = 'CONFIRMED'
        AND sh."end" < ${now}
        ${locationCond}
        ${daysCond}
      GROUP BY sg."userId"
    ),
    cohort_sizes AS (
      SELECT cohort_month, COUNT(*) AS cohort_size
      FROM volunteer_cohorts
      GROUP BY cohort_month
    ),
    monthly_activity AS (
      SELECT DISTINCT
        sg."userId",
        date_trunc('month', sh."end") AS activity_month
      FROM "Signup" sg
      JOIN "Shift" sh ON sh.id = sg."shiftId"
      WHERE sg.status = 'CONFIRMED'
        AND sh."end" < ${now}
        ${locationCond}
        ${daysCond}
    ),
    retention AS (
      SELECT
        vc.cohort_month,
        cs.cohort_size,
        (EXTRACT(YEAR FROM age(ma.activity_month, vc.cohort_month)) * 12 +
         EXTRACT(MONTH FROM age(ma.activity_month, vc.cohort_month)))::int AS months_since,
        COUNT(DISTINCT vc."userId") AS active_count
      FROM volunteer_cohorts vc
      JOIN monthly_activity ma ON ma."userId" = vc."userId"
      JOIN cohort_sizes cs ON cs.cohort_month = vc.cohort_month
      WHERE ma.activity_month >= vc.cohort_month
      GROUP BY vc.cohort_month, cs.cohort_size, months_since
    )
    SELECT
      cohort_month AS "cohortMonth",
      cohort_size::bigint AS "cohortSize",
      months_since::int AS "monthsSince",
      active_count::bigint AS "activeCount"
    FROM retention
    WHERE cohort_month >= ${cutoff}
      AND months_since >= 0
      AND months_since <= 11
    ORDER BY cohort_month, months_since
  `;

  const nowMonthIndex = now.getFullYear() * 12 + now.getMonth();
  const cohortMap = new Map<
    string,
    { label: string; size: number; monthIndex: number; retentionMap: Map<number, number> }
  >();

  for (const row of result) {
    const date = new Date(row.cohortMonth);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleDateString("en-NZ", {
      month: "short",
      year: "2-digit",
    });

    if (!cohortMap.has(key)) {
      cohortMap.set(key, {
        label,
        size: Number(row.cohortSize),
        monthIndex: date.getFullYear() * 12 + date.getMonth(),
        retentionMap: new Map(),
      });
    }

    const cohort = cohortMap.get(key)!;
    const pct = Math.round(
      (Number(row.activeCount) / cohort.size) * 100
    );
    cohort.retentionMap.set(row.monthsSince, pct);
  }

  let maxMonths = 0;
  const cohorts = Array.from(cohortMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, cohort]) => {
      const maxOffset = Math.min(nowMonthIndex - cohort.monthIndex, 11);
      const retention: (number | null)[] = [];
      for (let i = 0; i <= 11; i++) {
        if (i > maxOffset) {
          retention.push(null);
        } else {
          retention.push(cohort.retentionMap.get(i) || 0);
        }
      }
      if (maxOffset + 1 > maxMonths) maxMonths = maxOffset + 1;
      return { label: cohort.label, size: cohort.size, retention };
    });

  return { cohorts, maxMonths };
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
  daysFilter: number[] | null;
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
    daysFilter,
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
  const daysCond = daysFilter && daysFilter.length > 0
    ? Prisma.sql`AND EXTRACT(DOW FROM ${shiftStartNZ()})::int IN (${Prisma.join(daysFilter)})`
    : Prisma.empty;

  const searchCond = search
    ? Prisma.sql`AND (
        LOWER(u.name) LIKE ${`%${search.toLowerCase()}%`}
        OR LOWER(u."firstName") LIKE ${`%${search.toLowerCase()}%`}
        OR LOWER(u."lastName") LIKE ${`%${search.toLowerCase()}%`}
        OR LOWER(u.email) LIKE ${`%${search.toLowerCase()}%`}
      )`
    : Prisma.empty;

  // When location-filtered, skip volunteers with no association to this location
  // (no shifts there AND this isn't their default location)
  const skipCond = isLocationFiltered
    ? Prisma.sql`total_shifts = 0 AND NOT has_default_location`
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
        COALESCE(COUNT(sg.id) FILTER (WHERE sh."end" < ${now} AND ${locationCond} ${daysCond}), 0) as total_shifts,
        COALESCE(COUNT(sg.id) FILTER (WHERE sh."end" >= ${periodStart} AND sh."end" < ${now} AND ${locationCond} ${daysCond}), 0) as shifts_in_period,
        MAX(sh."end") FILTER (WHERE sh."end" < ${now} AND ${locationCond} ${daysCond}) as last_shift_date,
        CASE
          WHEN u."defaultLocation" = ${location || ''}
          THEN TRUE
          ELSE FALSE
        END as has_default_location
      FROM "User" u
      LEFT JOIN "Signup" sg ON sg."userId" = u.id AND sg.status = 'CONFIRMED'
      LEFT JOIN "Shift" sh ON sh.id = sg."shiftId"
      WHERE u.role = 'VOLUNTEER'::"Role"
        ${searchCond}
      GROUP BY u.id, u.name, u."firstName", u."lastName", u.email,
        u."profilePhotoUrl", u."volunteerGrade", u."createdAt",
        u."defaultLocation"
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
