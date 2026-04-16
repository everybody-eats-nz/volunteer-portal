import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/client";
import { nowInNZT, toNZT } from "@/lib/timezone";

export interface RecruitmentFunnel {
  totalRegistrations: number;
  /** Registered but profileCompleted = false */
  incompleteProfiles: number;
  /** profileCompleted = true, zero signups ever */
  completedProfileNoSignup: number;
  /** Has at least one signup record, but zero confirmed shifts */
  signedUpNoShift: number;
  /** Has at least one confirmed completed shift */
  completedShift: number;
  /** Average days from registration to first completed shift (null if no data) */
  avgDaysToFirstShift: number | null;
  sameDay: number;     // 0 days
  within3Days: number; // 1–3 days
  within7Days: number; // 4–7 days
  within14Days: number; // 8–14 days
  within30Days: number; // 15–30 days
  within60Days: number; // 31–60 days
  within90Days: number; // 61–90 days
  over90Days: number;   // 91+ days
}

export interface RecruitmentData {
  funnel: RecruitmentFunnel;
  /** 12-month rolling monthly registration counts (filled with 0 for empty months) */
  registrationTrend: Array<{ month: string; count: number }>;
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

  const [funnelResult, trendResult] = await Promise.all([
    // ── Funnel query (scoped to the selected period) ──────────────────────────
    prisma.$queryRaw<
      Array<{
        totalRegistrations: bigint;
        incompleteProfiles: bigint;
        completedProfileNoSignup: bigint;
        signedUpNoShift: bigint;
        completedShift: bigint;
        avgDaysToFirstShift: number | null;
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
        SELECT u.id, u."profileCompleted", u."createdAt"
        FROM "User" u
        WHERE u.role = 'VOLUNTEER'::"Role"
          AND u."createdAt" >= ${periodStart}
          AND u."createdAt" < ${now}
          ${locationCond}
      ),
      user_stats AS (
        SELECT
          ub.id,
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
        GROUP BY ub.id, ub."profileCompleted", ub."createdAt"
      )
      SELECT
        COUNT(*)::bigint                                                               AS "totalRegistrations",
        COUNT(*) FILTER (WHERE NOT "profileCompleted")::bigint                        AS "incompleteProfiles",
        COUNT(*) FILTER (WHERE "profileCompleted" AND total_signups = 0)::bigint      AS "completedProfileNoSignup",
        COUNT(*) FILTER (WHERE total_signups > 0 AND confirmed_shifts = 0)::bigint    AS "signedUpNoShift",
        COUNT(*) FILTER (WHERE confirmed_shifts > 0)::bigint                          AS "completedShift",
        AVG(
          EXTRACT(EPOCH FROM (first_shift_date - "createdAt")) / 86400.0
        ) FILTER (WHERE first_shift_date IS NOT NULL)::float                          AS "avgDaysToFirstShift",
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
    `,

    // ── 12-month trend (always full year for chart context) ───────────────────
    // Convert createdAt from UTC to NZ time before truncating to month so that
    // registrations are grouped into the NZ calendar month they actually occurred in.
    prisma.$queryRaw<Array<{ month: string; count: bigint }>>`
      SELECT
        to_char(
          date_trunc('month', (u."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Pacific/Auckland'),
          'YYYY-MM'
        )                AS month,
        COUNT(*)::bigint AS count
      FROM "User" u
      WHERE u.role = 'VOLUNTEER'::"Role"
        AND u."createdAt" >= ${trendStart}
        AND u."createdAt" < ${now}
        ${locationCond}
      GROUP BY date_trunc('month', (u."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Pacific/Auckland')
      ORDER BY month
    `,
  ]);

  const f = funnelResult[0];
  const trendMap = new Map(trendResult.map((r) => [r.month, Number(r.count)]));

  // Iterate NZ months so that keys match the NZ-grouped SQL output.
  // toNZT() returns a TZDate whose getMonth()/setMonth() operate in NZ timezone.
  const registrationTrend: Array<{ month: string; count: number }> = [];
  const nzCursor = toNZT(trendStart);
  nzCursor.setDate(1);
  while (nzCursor.getTime() < now.getTime()) {
    const key = `${nzCursor.getFullYear()}-${String(nzCursor.getMonth() + 1).padStart(2, "0")}`;
    registrationTrend.push({
      month: nzCursor.toLocaleDateString("en-NZ", {
        month: "short",
        year: "2-digit",
      }),
      count: trendMap.get(key) ?? 0,
    });
    nzCursor.setMonth(nzCursor.getMonth() + 1);
  }

  const rawAvg = f?.avgDaysToFirstShift;

  return {
    funnel: {
      totalRegistrations:        Number(f?.totalRegistrations        ?? 0),
      incompleteProfiles:        Number(f?.incompleteProfiles        ?? 0),
      completedProfileNoSignup:  Number(f?.completedProfileNoSignup  ?? 0),
      signedUpNoShift:           Number(f?.signedUpNoShift           ?? 0),
      completedShift:            Number(f?.completedShift            ?? 0),
      avgDaysToFirstShift:
        rawAvg != null ? Math.round(Number(rawAvg) * 10) / 10 : null,
      sameDay:       Number(f?.sameDay      ?? 0),
      within3Days:   Number(f?.within3Days  ?? 0),
      within7Days:   Number(f?.within7Days  ?? 0),
      within14Days:  Number(f?.within14Days ?? 0),
      within30Days:  Number(f?.within30Days ?? 0),
      within60Days:  Number(f?.within60Days ?? 0),
      within90Days:  Number(f?.within90Days ?? 0),
      over90Days:    Number(f?.over90Days   ?? 0),
    },
    registrationTrend,
  };
}
