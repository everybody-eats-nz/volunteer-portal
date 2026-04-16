import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/client";
import { nowInNZT } from "@/lib/timezone";

export const MILESTONE_THRESHOLDS = [10, 25, 50, 100, 200, 500] as const;
export type MilestoneThreshold = (typeof MILESTONE_THRESHOLDS)[number];

export interface MilestoneHit {
  threshold: number;
  hitInPeriod: number;
  allTimeTotal: number;
}

export interface DistributionBucket {
  label: string;
  minShifts: number;
  maxShifts: number | null;
  count: number;
}

export interface ApproachingVolunteer {
  userId: string;
  name: string;
  totalShifts: number;
  shiftsNeeded: number;
  monthlyRate: number;
  projectedMonths: number | null;
}

export interface MilestoneProjection {
  threshold: number;
  alreadyHit: number;
  projectedAdditional: number;
  approaching: ApproachingVolunteer[];
}

export interface MilestoneData {
  milestoneHits: MilestoneHit[];
  distribution: DistributionBucket[];
  projections: MilestoneProjection[];
}

export async function getMilestoneData(
  months: number,
  location: string | null
): Promise<MilestoneData> {
  const nzNow = nowInNZT();
  const now = new Date(nzNow.getTime());

  const nzPeriodStart = nowInNZT();
  nzPeriodStart.setMonth(nzPeriodStart.getMonth() - months);
  const periodStart = new Date(nzPeriodStart.getTime());

  const nzSixMonthsAgo = nowInNZT();
  nzSixMonthsAgo.setMonth(nzSixMonthsAgo.getMonth() - 6);
  const sixMonthsAgo = new Date(nzSixMonthsAgo.getTime());

  const isLocationFiltered = !!location && location !== "all";
  const locationCond = isLocationFiltered
    ? Prisma.sql`AND u."availableLocations" LIKE ${`%"${location}"%`}`
    : Prisma.empty;

  const [hitsInPeriodResult, totalsResult, volunteerStatsResult] =
    await Promise.all([
      // How many volunteers crossed each milestone threshold in the selected period
      prisma.$queryRaw<Array<{ milestone: bigint; count: bigint }>>`
        WITH ranked AS (
          SELECT
            sg."userId",
            sh."end" AS shift_end,
            ROW_NUMBER() OVER (PARTITION BY sg."userId" ORDER BY sh."end") AS rn
          FROM "Signup" sg
          JOIN "Shift"  sh ON sh.id = sg."shiftId"
          JOIN "User"   u  ON u.id  = sg."userId"
          WHERE sg.status = 'CONFIRMED'::"SignupStatus"
            AND sh."end" < ${now}
            AND u.role   = 'VOLUNTEER'::"Role"
            ${locationCond}
        )
        SELECT
          rn::bigint AS milestone,
          COUNT(*)::bigint AS count
        FROM ranked
        WHERE shift_end >= ${periodStart}
          AND shift_end <  ${now}
          AND rn IN (10, 25, 50, 100, 200, 500)
        GROUP BY rn
        ORDER BY rn
      `,

      // All-time totals per milestone + current distribution buckets
      prisma.$queryRaw<
        Array<{
          ten: bigint;
          twentyfive: bigint;
          fifty: bigint;
          hundred: bigint;
          twohundred: bigint;
          fivehundred: bigint;
          d_1_9: bigint;
          d_10_24: bigint;
          d_25_49: bigint;
          d_50_99: bigint;
          d_100_199: bigint;
          d_200_499: bigint;
          d_500_plus: bigint;
        }>
      >`
        WITH user_totals AS (
          SELECT sg."userId", COUNT(*) AS n
          FROM "Signup" sg
          JOIN "Shift" sh ON sh.id = sg."shiftId"
          JOIN "User"  u  ON u.id  = sg."userId"
          WHERE sg.status = 'CONFIRMED'::"SignupStatus"
            AND sh."end" < ${now}
            AND u.role   = 'VOLUNTEER'::"Role"
            ${locationCond}
          GROUP BY sg."userId"
        )
        SELECT
          COUNT(*) FILTER (WHERE n >= 10)::bigint   AS ten,
          COUNT(*) FILTER (WHERE n >= 25)::bigint   AS twentyfive,
          COUNT(*) FILTER (WHERE n >= 50)::bigint   AS fifty,
          COUNT(*) FILTER (WHERE n >= 100)::bigint  AS hundred,
          COUNT(*) FILTER (WHERE n >= 200)::bigint  AS twohundred,
          COUNT(*) FILTER (WHERE n >= 500)::bigint  AS fivehundred,
          COUNT(*) FILTER (WHERE n BETWEEN 1   AND 9)   ::bigint AS d_1_9,
          COUNT(*) FILTER (WHERE n BETWEEN 10  AND 24)  ::bigint AS d_10_24,
          COUNT(*) FILTER (WHERE n BETWEEN 25  AND 49)  ::bigint AS d_25_49,
          COUNT(*) FILTER (WHERE n BETWEEN 50  AND 99)  ::bigint AS d_50_99,
          COUNT(*) FILTER (WHERE n BETWEEN 100 AND 199) ::bigint AS d_100_199,
          COUNT(*) FILTER (WHERE n BETWEEN 200 AND 499) ::bigint AS d_200_499,
          COUNT(*) FILTER (WHERE n >= 500)              ::bigint AS d_500_plus
        FROM user_totals
      `,

      // Per-volunteer stats for projections and approaching lists
      prisma.$queryRaw<
        Array<{
          userId: string;
          name: string | null;
          total_shifts: bigint;
          recent_shifts: bigint;
        }>
      >`
        SELECT
          sg."userId",
          u.name,
          COUNT(*)::bigint AS total_shifts,
          COUNT(*) FILTER (WHERE sh."end" >= ${sixMonthsAgo})::bigint AS recent_shifts
        FROM "Signup" sg
        JOIN "Shift" sh ON sh.id = sg."shiftId"
        JOIN "User"  u  ON u.id  = sg."userId"
        WHERE sg.status = 'CONFIRMED'::"SignupStatus"
          AND sh."end" < ${now}
          AND u.role   = 'VOLUNTEER'::"Role"
          ${locationCond}
        GROUP BY sg."userId", u.name
        HAVING COUNT(*) > 0
        ORDER BY COUNT(*) DESC
      `,
    ]);

  // ── Milestone hits in period ───────────────────────────────────────────────
  const hitsMap = new Map(
    hitsInPeriodResult.map((r) => [Number(r.milestone), Number(r.count)])
  );

  const t = totalsResult[0];
  const allTimeTotals: Record<number, number> = {
    10: Number(t?.ten ?? 0),
    25: Number(t?.twentyfive ?? 0),
    50: Number(t?.fifty ?? 0),
    100: Number(t?.hundred ?? 0),
    200: Number(t?.twohundred ?? 0),
    500: Number(t?.fivehundred ?? 0),
  };

  const milestoneHits: MilestoneHit[] = MILESTONE_THRESHOLDS.map(
    (threshold) => ({
      threshold,
      hitInPeriod: hitsMap.get(threshold) ?? 0,
      allTimeTotal: allTimeTotals[threshold] ?? 0,
    })
  );

  // ── Distribution buckets ──────────────────────────────────────────────────
  const distribution: DistributionBucket[] = [
    {
      label: "1–9",
      minShifts: 1,
      maxShifts: 9,
      count: Number(t?.d_1_9 ?? 0),
    },
    {
      label: "10–24",
      minShifts: 10,
      maxShifts: 24,
      count: Number(t?.d_10_24 ?? 0),
    },
    {
      label: "25–49",
      minShifts: 25,
      maxShifts: 49,
      count: Number(t?.d_25_49 ?? 0),
    },
    {
      label: "50–99",
      minShifts: 50,
      maxShifts: 99,
      count: Number(t?.d_50_99 ?? 0),
    },
    {
      label: "100–199",
      minShifts: 100,
      maxShifts: 199,
      count: Number(t?.d_100_199 ?? 0),
    },
    {
      label: "200–499",
      minShifts: 200,
      maxShifts: 499,
      count: Number(t?.d_200_499 ?? 0),
    },
    {
      label: "500+",
      minShifts: 500,
      maxShifts: null,
      count: Number(t?.d_500_plus ?? 0),
    },
  ];

  // ── Projections ───────────────────────────────────────────────────────────
  const PROJECTION_MONTHS = 12;
  const volunteers = volunteerStatsResult.map((v) => ({
    userId: v.userId,
    name: v.name ?? "Unknown",
    totalShifts: Number(v.total_shifts),
    recentShifts: Number(v.recent_shifts),
    // Average shifts per month over the last 6 months
    monthlyRate: Number(v.recent_shifts) / 6,
  }));

  const projections: MilestoneProjection[] = MILESTONE_THRESHOLDS.map(
    (threshold) => {
      const alreadyHit = allTimeTotals[threshold] ?? 0;

      // Volunteers who haven't yet hit this milestone
      const notYetHit = volunteers.filter(
        (v) => v.totalShifts < threshold
      );

      // Among those, project who will hit it in the next 12 months
      // Only project for volunteers with a positive recent rate
      const projectedAdditional = notYetHit.filter((v) => {
        if (v.monthlyRate <= 0) return false;
        const shiftsNeeded = threshold - v.totalShifts;
        const monthsNeeded = shiftsNeeded / v.monthlyRate;
        return monthsNeeded <= PROJECTION_MONTHS;
      }).length;

      // Approaching: within 20% of the milestone (below it)
      const approachingMinShifts = Math.floor(threshold * 0.8);
      const approaching: ApproachingVolunteer[] = notYetHit
        .filter((v) => v.totalShifts >= approachingMinShifts)
        .map((v) => {
          const shiftsNeeded = threshold - v.totalShifts;
          const projectedMonths =
            v.monthlyRate > 0
              ? Math.ceil(shiftsNeeded / v.monthlyRate)
              : null;
          return {
            userId: v.userId,
            name: v.name,
            totalShifts: v.totalShifts,
            shiftsNeeded,
            monthlyRate: Math.round(v.monthlyRate * 10) / 10,
            projectedMonths,
          };
        })
        .sort((a, b) => a.shiftsNeeded - b.shiftsNeeded);

      return { threshold, alreadyHit, projectedAdditional, approaching };
    }
  );

  return { milestoneHits, distribution, projections };
}
