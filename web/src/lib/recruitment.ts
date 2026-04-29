import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/client";
import { nowInNZT, toNZT } from "@/lib/timezone";
import {
  UNSPECIFIED_LOCATION,
  type RecruitmentData,
  type RecruitmentFunnelBreakdown,
  type RecruitmentTrendPoint,
} from "@/lib/recruitment-types";

export {
  UNSPECIFIED_LOCATION,
  type RecruitmentData,
  type RecruitmentFunnel,
  type RecruitmentFunnelBreakdown,
  type RecruitmentTrendPoint,
} from "@/lib/recruitment-types";

function sortLocations(names: Iterable<string>): string[] {
  const list = Array.from(new Set(names)).filter(Boolean);
  list.sort((a, b) => {
    if (a === UNSPECIFIED_LOCATION && b !== UNSPECIFIED_LOCATION) return 1;
    if (b === UNSPECIFIED_LOCATION && a !== UNSPECIFIED_LOCATION) return -1;
    return a.localeCompare(b);
  });
  return list;
}

export async function getRecruitmentData(
  months: number,
  location: string | null
): Promise<RecruitmentData> {
  // All date boundaries are anchored to NZ time so that monthly groupings
  // and period filters reflect NZ calendar dates, not UTC. Vercel runs in UTC,
  // so without this a registration at 11 pm NZT would shift to the next UTC day.
  const nzNow = nowInNZT();
  const now = new Date(nzNow.getTime());

  const nzPeriodStart = nowInNZT();
  nzPeriodStart.setMonth(nzPeriodStart.getMonth() - months);
  const periodStart = new Date(nzPeriodStart.getTime());

  // Always show 12 months in the trend chart regardless of the period filter
  const nzTrendStart = nowInNZT();
  nzTrendStart.setMonth(nzTrendStart.getMonth() - 12);
  const trendStart = new Date(nzTrendStart.getTime());

  const isLocationFiltered = !!location && location !== "all";
  // Filter by preferred location stored as a JSON string array in availableLocations
  const locationCond = isLocationFiltered
    ? Prisma.sql`AND u."availableLocations" LIKE ${`%"${location}"%`}`
    : Prisma.empty;

  const [funnelRows, avgResult, trendResult] = await Promise.all([
    // ── Funnel query: one row per defaultLocation bucket ─────────────────────
    prisma.$queryRaw<
      Array<{
        location: string;
        totalRegistrations: bigint;
        incompleteProfiles: bigint;
        completedProfileNoSignup: bigint;
        signedUpNoShift: bigint;
        completedShift: bigint;
        sameDay: bigint;
        within3Days: bigint;
        within7Days: bigint;
        within14Days: bigint;
        within30Days: bigint;
        within60Days: bigint;
        within90Days: bigint;
        over90Days: bigint;
      }>
    >`
      WITH user_base AS (
        SELECT
          u.id,
          u."profileCompleted",
          u."createdAt",
          COALESCE(NULLIF(u."defaultLocation", ''), ${UNSPECIFIED_LOCATION}) AS location
        FROM "User" u
        WHERE u.role = 'VOLUNTEER'::"Role"
          AND u."createdAt" >= ${periodStart}
          AND u."createdAt" < ${now}
          ${locationCond}
      ),
      user_stats AS (
        SELECT
          ub.id,
          ub.location,
          ub."profileCompleted",
          ub."createdAt",
          COUNT(sg.id)                                                                  AS total_signups,
          COUNT(sg.id) FILTER (
            WHERE sg.status = 'CONFIRMED'::"SignupStatus" AND sh."end" < ${now}
          )                                                                             AS confirmed_shifts,
          MIN(sh."end") FILTER (
            WHERE sg.status = 'CONFIRMED'::"SignupStatus" AND sh."end" < ${now}
          )                                                                             AS first_shift_date
        FROM user_base ub
        LEFT JOIN "Signup" sg ON sg."userId" = ub.id
        LEFT JOIN "Shift"  sh ON sh.id = sg."shiftId"
        GROUP BY ub.id, ub.location, ub."profileCompleted", ub."createdAt"
      )
      SELECT
        location                                                                       AS "location",
        COUNT(*)::bigint                                                               AS "totalRegistrations",
        COUNT(*) FILTER (WHERE NOT "profileCompleted")::bigint                         AS "incompleteProfiles",
        COUNT(*) FILTER (WHERE "profileCompleted" AND total_signups = 0)::bigint       AS "completedProfileNoSignup",
        COUNT(*) FILTER (WHERE total_signups > 0 AND confirmed_shifts = 0)::bigint     AS "signedUpNoShift",
        COUNT(*) FILTER (WHERE confirmed_shifts > 0)::bigint                           AS "completedShift",
        COUNT(*) FILTER (
          WHERE first_shift_date IS NOT NULL
            AND EXTRACT(EPOCH FROM (first_shift_date - "createdAt")) / 86400.0 < 1
        )::bigint                                                                      AS "sameDay",
        COUNT(*) FILTER (
          WHERE first_shift_date IS NOT NULL
            AND EXTRACT(EPOCH FROM (first_shift_date - "createdAt")) / 86400.0 >= 1
            AND EXTRACT(EPOCH FROM (first_shift_date - "createdAt")) / 86400.0 <= 3
        )::bigint                                                                      AS "within3Days",
        COUNT(*) FILTER (
          WHERE first_shift_date IS NOT NULL
            AND EXTRACT(EPOCH FROM (first_shift_date - "createdAt")) / 86400.0 > 3
            AND EXTRACT(EPOCH FROM (first_shift_date - "createdAt")) / 86400.0 <= 7
        )::bigint                                                                      AS "within7Days",
        COUNT(*) FILTER (
          WHERE first_shift_date IS NOT NULL
            AND EXTRACT(EPOCH FROM (first_shift_date - "createdAt")) / 86400.0 > 7
            AND EXTRACT(EPOCH FROM (first_shift_date - "createdAt")) / 86400.0 <= 14
        )::bigint                                                                      AS "within14Days",
        COUNT(*) FILTER (
          WHERE first_shift_date IS NOT NULL
            AND EXTRACT(EPOCH FROM (first_shift_date - "createdAt")) / 86400.0 > 14
            AND EXTRACT(EPOCH FROM (first_shift_date - "createdAt")) / 86400.0 <= 30
        )::bigint                                                                      AS "within30Days",
        COUNT(*) FILTER (
          WHERE first_shift_date IS NOT NULL
            AND EXTRACT(EPOCH FROM (first_shift_date - "createdAt")) / 86400.0 > 30
            AND EXTRACT(EPOCH FROM (first_shift_date - "createdAt")) / 86400.0 <= 60
        )::bigint                                                                      AS "within60Days",
        COUNT(*) FILTER (
          WHERE first_shift_date IS NOT NULL
            AND EXTRACT(EPOCH FROM (first_shift_date - "createdAt")) / 86400.0 > 60
            AND EXTRACT(EPOCH FROM (first_shift_date - "createdAt")) / 86400.0 <= 90
        )::bigint                                                                      AS "within90Days",
        COUNT(*) FILTER (
          WHERE first_shift_date IS NOT NULL
            AND EXTRACT(EPOCH FROM (first_shift_date - "createdAt")) / 86400.0 > 90
        )::bigint                                                                      AS "over90Days"
      FROM user_stats
      GROUP BY location
      ORDER BY location
    `,

    // ── Overall average days to first shift (one number across all locations) ─
    prisma.$queryRaw<Array<{ avgDaysToFirstShift: number | null }>>`
      WITH user_base AS (
        SELECT u.id, u."createdAt"
        FROM "User" u
        WHERE u.role = 'VOLUNTEER'::"Role"
          AND u."createdAt" >= ${periodStart}
          AND u."createdAt" < ${now}
          ${locationCond}
      ),
      first_shift AS (
        SELECT
          ub.id,
          ub."createdAt",
          MIN(sh."end") FILTER (
            WHERE sg.status = 'CONFIRMED'::"SignupStatus" AND sh."end" < ${now}
          ) AS first_shift_date
        FROM user_base ub
        LEFT JOIN "Signup" sg ON sg."userId" = ub.id
        LEFT JOIN "Shift"  sh ON sh.id = sg."shiftId"
        GROUP BY ub.id, ub."createdAt"
      )
      SELECT
        AVG(
          EXTRACT(EPOCH FROM (first_shift_date - "createdAt")) / 86400.0
        ) FILTER (WHERE first_shift_date IS NOT NULL)::float AS "avgDaysToFirstShift"
      FROM first_shift
    `,

    // ── 12-month trend grouped by month AND defaultLocation ──────────────────
    // Convert createdAt from UTC to NZ time before truncating to month so that
    // registrations are grouped into the NZ calendar month they actually occurred in.
    prisma.$queryRaw<
      Array<{ month: string; location: string; count: bigint }>
    >`
      SELECT
        to_char(
          date_trunc('month', (u."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Pacific/Auckland'),
          'YYYY-MM'
        )                                                                      AS month,
        COALESCE(NULLIF(u."defaultLocation", ''), ${UNSPECIFIED_LOCATION})     AS location,
        COUNT(*)::bigint                                                        AS count
      FROM "User" u
      WHERE u.role = 'VOLUNTEER'::"Role"
        AND u."createdAt" >= ${trendStart}
        AND u."createdAt" < ${now}
        ${locationCond}
      GROUP BY month, location
      ORDER BY month
    `,
  ]);

  // Build per-location funnel rows and aggregate totals.
  const byLocation: RecruitmentFunnelBreakdown[] = funnelRows.map((r) => ({
    location: r.location ?? UNSPECIFIED_LOCATION,
    totalRegistrations: Number(r.totalRegistrations ?? 0),
    incompleteProfiles: Number(r.incompleteProfiles ?? 0),
    completedProfileNoSignup: Number(r.completedProfileNoSignup ?? 0),
    signedUpNoShift: Number(r.signedUpNoShift ?? 0),
    completedShift: Number(r.completedShift ?? 0),
    sameDay: Number(r.sameDay ?? 0),
    within3Days: Number(r.within3Days ?? 0),
    within7Days: Number(r.within7Days ?? 0),
    within14Days: Number(r.within14Days ?? 0),
    within30Days: Number(r.within30Days ?? 0),
    within60Days: Number(r.within60Days ?? 0),
    within90Days: Number(r.within90Days ?? 0),
    over90Days: Number(r.over90Days ?? 0),
  }));

  const sumKey = (
    key: keyof Omit<RecruitmentFunnelBreakdown, "location">
  ): number => byLocation.reduce((acc, row) => acc + row[key], 0);

  const rawAvg = avgResult[0]?.avgDaysToFirstShift;

  // Build 12-month trend with per-location buckets.
  type MonthBuckets = { count: number; byLocation: Record<string, number> };
  const trendMap = new Map<string, MonthBuckets>();
  for (const row of trendResult) {
    const key = row.month;
    const loc = row.location ?? UNSPECIFIED_LOCATION;
    const add = Number(row.count);
    const bucket = trendMap.get(key) ?? { count: 0, byLocation: {} };
    bucket.count += add;
    bucket.byLocation[loc] = (bucket.byLocation[loc] ?? 0) + add;
    trendMap.set(key, bucket);
  }

  // Iterate NZ months so that keys match the NZ-grouped SQL output.
  // toNZT() returns a TZDate whose getMonth()/setMonth() operate in NZ timezone.
  const registrationTrend: RecruitmentTrendPoint[] = [];
  const nzCursor = toNZT(trendStart);
  nzCursor.setDate(1);
  while (nzCursor.getTime() < now.getTime()) {
    const key = `${nzCursor.getFullYear()}-${String(
      nzCursor.getMonth() + 1
    ).padStart(2, "0")}`;
    const bucket = trendMap.get(key);
    registrationTrend.push({
      month: nzCursor.toLocaleDateString("en-NZ", {
        month: "short",
        year: "2-digit",
      }),
      monthKey: key,
      count: bucket?.count ?? 0,
      byLocation: bucket?.byLocation ?? {},
    });
    nzCursor.setMonth(nzCursor.getMonth() + 1);
  }

  const locations = sortLocations([
    ...byLocation.map((b) => b.location),
    ...registrationTrend.flatMap((t) => Object.keys(t.byLocation)),
  ]);

  return {
    funnel: {
      totalRegistrations: sumKey("totalRegistrations"),
      incompleteProfiles: sumKey("incompleteProfiles"),
      completedProfileNoSignup: sumKey("completedProfileNoSignup"),
      signedUpNoShift: sumKey("signedUpNoShift"),
      completedShift: sumKey("completedShift"),
      avgDaysToFirstShift:
        rawAvg != null ? Math.round(Number(rawAvg) * 10) / 10 : null,
      sameDay: sumKey("sameDay"),
      within3Days: sumKey("within3Days"),
      within7Days: sumKey("within7Days"),
      within14Days: sumKey("within14Days"),
      within30Days: sumKey("within30Days"),
      within60Days: sumKey("within60Days"),
      within90Days: sumKey("within90Days"),
      over90Days: sumKey("over90Days"),
      byLocation,
    },
    registrationTrend,
    locations,
  };
}
