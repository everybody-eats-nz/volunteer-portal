import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/client";
import { nowInNZT } from "@/lib/timezone";
import { UNSPECIFIED_LOCATION } from "@/lib/recruitment-types";

export { UNSPECIFIED_LOCATION } from "@/lib/recruitment-types";

export const MILESTONE_THRESHOLDS = [10, 25, 50, 100, 200, 500] as const;
export type MilestoneThreshold = (typeof MILESTONE_THRESHOLDS)[number];

export interface MilestoneHit {
  threshold: number;
  hitInPeriod: number;
  allTimeTotal: number;
  byLocation: Record<string, { hitInPeriod: number; allTimeTotal: number }>;
}

export interface DistributionBucket {
  label: string;
  minShifts: number;
  maxShifts: number | null;
  count: number;
  byLocation: Record<string, number>;
}

export interface ApproachingVolunteer {
  userId: string;
  name: string;
  location: string;
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
  byLocation: Record<
    string,
    { alreadyHit: number; projectedAdditional: number }
  >;
}

export interface RecentMilestoneAchievement {
  userId: string;
  name: string;
  location: string;
  threshold: number;
  achievedAt: string;
  totalShifts: number;
}

export interface MilestoneData {
  milestoneHits: MilestoneHit[];
  distribution: DistributionBucket[];
  projections: MilestoneProjection[];
  recentAchievements: RecentMilestoneAchievement[];
  locations: string[];
}

function sortLocations(names: Iterable<string>): string[] {
  const list = Array.from(new Set(names)).filter(Boolean);
  list.sort((a, b) => {
    if (a === UNSPECIFIED_LOCATION && b !== UNSPECIFIED_LOCATION) return 1;
    if (b === UNSPECIFIED_LOCATION && a !== UNSPECIFIED_LOCATION) return -1;
    return a.localeCompare(b);
  });
  return list;
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

  const [
    hitsInPeriodResult,
    totalsResult,
    volunteerStatsResult,
    recentAchievementsResult,
  ] = await Promise.all([
    // Milestone crossings in the selected period, grouped by threshold & location
    prisma.$queryRaw<
      Array<{ milestone: bigint; location: string; count: bigint }>
    >`
      WITH ranked AS (
        SELECT
          sg."userId",
          sh."end" AS shift_end,
          ROW_NUMBER() OVER (PARTITION BY sg."userId" ORDER BY sh."end") AS rn,
          COALESCE(NULLIF(u."defaultLocation", ''), ${UNSPECIFIED_LOCATION}) AS location
        FROM "Signup" sg
        JOIN "Shift"  sh ON sh.id = sg."shiftId"
        JOIN "User"   u  ON u.id  = sg."userId"
        WHERE sg.status = 'CONFIRMED'::"SignupStatus"
          AND sh."end" < ${now}
          AND u.role   = 'VOLUNTEER'::"Role"
          ${locationCond}
      )
      SELECT
        rn::bigint       AS milestone,
        location,
        COUNT(*)::bigint AS count
      FROM ranked
      WHERE shift_end >= ${periodStart}
        AND shift_end <  ${now}
        AND rn IN (10, 25, 50, 100, 200, 500)
      GROUP BY rn, location
      ORDER BY rn, location
    `,

    // All-time totals per milestone + distribution buckets, one row per location
    prisma.$queryRaw<
      Array<{
        location: string;
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
        SELECT
          sg."userId",
          COALESCE(NULLIF(u."defaultLocation", ''), ${UNSPECIFIED_LOCATION}) AS location,
          COUNT(*) AS n
        FROM "Signup" sg
        JOIN "Shift" sh ON sh.id = sg."shiftId"
        JOIN "User"  u  ON u.id  = sg."userId"
        WHERE sg.status = 'CONFIRMED'::"SignupStatus"
          AND sh."end" < ${now}
          AND u.role   = 'VOLUNTEER'::"Role"
          ${locationCond}
        GROUP BY sg."userId", u."defaultLocation"
      )
      SELECT
        location,
        COUNT(*) FILTER (WHERE n >= 10)::bigint                 AS ten,
        COUNT(*) FILTER (WHERE n >= 25)::bigint                 AS twentyfive,
        COUNT(*) FILTER (WHERE n >= 50)::bigint                 AS fifty,
        COUNT(*) FILTER (WHERE n >= 100)::bigint                AS hundred,
        COUNT(*) FILTER (WHERE n >= 200)::bigint                AS twohundred,
        COUNT(*) FILTER (WHERE n >= 500)::bigint                AS fivehundred,
        COUNT(*) FILTER (WHERE n BETWEEN 1   AND 9)::bigint     AS d_1_9,
        COUNT(*) FILTER (WHERE n BETWEEN 10  AND 24)::bigint    AS d_10_24,
        COUNT(*) FILTER (WHERE n BETWEEN 25  AND 49)::bigint    AS d_25_49,
        COUNT(*) FILTER (WHERE n BETWEEN 50  AND 99)::bigint    AS d_50_99,
        COUNT(*) FILTER (WHERE n BETWEEN 100 AND 199)::bigint   AS d_100_199,
        COUNT(*) FILTER (WHERE n BETWEEN 200 AND 499)::bigint   AS d_200_499,
        COUNT(*) FILTER (WHERE n >= 500)::bigint                AS d_500_plus
      FROM user_totals
      GROUP BY location
      ORDER BY location
    `,

    // Per-volunteer stats (with primary restaurant) for projections and approaching lists
    prisma.$queryRaw<
      Array<{
        userId: string;
        name: string | null;
        location: string;
        total_shifts: bigint;
        recent_shifts: bigint;
      }>
    >`
      SELECT
        sg."userId",
        u.name,
        COALESCE(NULLIF(u."defaultLocation", ''), ${UNSPECIFIED_LOCATION}) AS location,
        COUNT(*)::bigint AS total_shifts,
        COUNT(*) FILTER (WHERE sh."end" >= ${sixMonthsAgo})::bigint AS recent_shifts
      FROM "Signup" sg
      JOIN "Shift" sh ON sh.id = sg."shiftId"
      JOIN "User"  u  ON u.id  = sg."userId"
      WHERE sg.status = 'CONFIRMED'::"SignupStatus"
        AND sh."end" < ${now}
        AND u.role   = 'VOLUNTEER'::"Role"
        ${locationCond}
      GROUP BY sg."userId", u.name, u."defaultLocation"
      HAVING COUNT(*) > 0
      ORDER BY COUNT(*) DESC
    `,

    // Volunteers who crossed a milestone during the selected period,
    // along with the shift that tipped them over and their current total.
    prisma.$queryRaw<
      Array<{
        userId: string;
        name: string | null;
        location: string;
        threshold: bigint;
        achieved_at: Date;
        total_shifts: bigint;
      }>
    >`
      WITH ranked AS (
        SELECT
          sg."userId",
          u.name,
          COALESCE(NULLIF(u."defaultLocation", ''), ${UNSPECIFIED_LOCATION}) AS location,
          sh."end" AS shift_end,
          ROW_NUMBER() OVER (PARTITION BY sg."userId" ORDER BY sh."end") AS rn,
          COUNT(*) OVER (PARTITION BY sg."userId") AS total_shifts
        FROM "Signup" sg
        JOIN "Shift" sh ON sh.id = sg."shiftId"
        JOIN "User"  u  ON u.id  = sg."userId"
        WHERE sg.status = 'CONFIRMED'::"SignupStatus"
          AND sh."end" < ${now}
          AND u.role   = 'VOLUNTEER'::"Role"
          ${locationCond}
      )
      SELECT
        "userId",
        name,
        location,
        rn::bigint        AS threshold,
        shift_end         AS achieved_at,
        total_shifts::bigint AS total_shifts
      FROM ranked
      WHERE shift_end >= ${periodStart}
        AND shift_end <  ${now}
        AND rn IN (10, 25, 50, 100, 200, 500)
      ORDER BY shift_end DESC
    `,
  ]);

  // Collect every location name we've seen across all result sets so the UI
  // can render a consistent, sorted series list.
  const locationSet = new Set<string>();
  for (const r of hitsInPeriodResult) locationSet.add(r.location);
  for (const r of totalsResult) locationSet.add(r.location);
  for (const r of volunteerStatsResult) locationSet.add(r.location);
  for (const r of recentAchievementsResult) locationSet.add(r.location);
  const locations = sortLocations(locationSet);

  // ── Milestone hits in period ───────────────────────────────────────────────
  // hits[threshold][location] = count
  const hitsByThresholdLocation: Record<number, Record<string, number>> = {};
  for (const r of hitsInPeriodResult) {
    const threshold = Number(r.milestone);
    if (!hitsByThresholdLocation[threshold])
      hitsByThresholdLocation[threshold] = {};
    hitsByThresholdLocation[threshold][r.location] = Number(r.count);
  }

  // allTimeByThresholdLocation[threshold][location]
  const allTimeByThresholdLocation: Record<
    number,
    Record<string, number>
  > = {};
  for (const t of MILESTONE_THRESHOLDS) allTimeByThresholdLocation[t] = {};

  for (const row of totalsResult) {
    allTimeByThresholdLocation[10][row.location] = Number(row.ten);
    allTimeByThresholdLocation[25][row.location] = Number(row.twentyfive);
    allTimeByThresholdLocation[50][row.location] = Number(row.fifty);
    allTimeByThresholdLocation[100][row.location] = Number(row.hundred);
    allTimeByThresholdLocation[200][row.location] = Number(row.twohundred);
    allTimeByThresholdLocation[500][row.location] = Number(row.fivehundred);
  }

  const milestoneHits: MilestoneHit[] = MILESTONE_THRESHOLDS.map((threshold) => {
    const hitsMap = hitsByThresholdLocation[threshold] ?? {};
    const allMap = allTimeByThresholdLocation[threshold] ?? {};
    const byLocation: Record<
      string,
      { hitInPeriod: number; allTimeTotal: number }
    > = {};
    for (const loc of locations) {
      byLocation[loc] = {
        hitInPeriod: hitsMap[loc] ?? 0,
        allTimeTotal: allMap[loc] ?? 0,
      };
    }
    return {
      threshold,
      hitInPeriod: Object.values(byLocation).reduce(
        (a, b) => a + b.hitInPeriod,
        0
      ),
      allTimeTotal: Object.values(byLocation).reduce(
        (a, b) => a + b.allTimeTotal,
        0
      ),
      byLocation,
    };
  });

  // ── Distribution buckets ──────────────────────────────────────────────────
  type TotalsRow = (typeof totalsResult)[number];
  type BucketKey =
    | "d_1_9"
    | "d_10_24"
    | "d_25_49"
    | "d_50_99"
    | "d_100_199"
    | "d_200_499"
    | "d_500_plus";
  const bucketDefs: Array<{
    label: string;
    minShifts: number;
    maxShifts: number | null;
    key: BucketKey;
  }> = [
    { label: "1–9", minShifts: 1, maxShifts: 9, key: "d_1_9" },
    { label: "10–24", minShifts: 10, maxShifts: 24, key: "d_10_24" },
    { label: "25–49", minShifts: 25, maxShifts: 49, key: "d_25_49" },
    { label: "50–99", minShifts: 50, maxShifts: 99, key: "d_50_99" },
    { label: "100–199", minShifts: 100, maxShifts: 199, key: "d_100_199" },
    { label: "200–499", minShifts: 200, maxShifts: 499, key: "d_200_499" },
    { label: "500+", minShifts: 500, maxShifts: null, key: "d_500_plus" },
  ];

  const distribution: DistributionBucket[] = bucketDefs.map(
    ({ label, minShifts, maxShifts, key }) => {
      const byLocation: Record<string, number> = {};
      let total = 0;
      for (const row of totalsResult) {
        const n = Number((row as TotalsRow)[key] ?? 0);
        byLocation[row.location] = n;
        total += n;
      }
      for (const loc of locations) {
        if (!(loc in byLocation)) byLocation[loc] = 0;
      }
      return { label, minShifts, maxShifts, count: total, byLocation };
    }
  );

  // ── Projections ───────────────────────────────────────────────────────────
  const PROJECTION_MONTHS = 12;
  const volunteers = volunteerStatsResult.map((v) => ({
    userId: v.userId,
    name: v.name ?? "Unknown",
    location: v.location,
    totalShifts: Number(v.total_shifts),
    recentShifts: Number(v.recent_shifts),
    // Average shifts per month over the last 6 months
    monthlyRate: Number(v.recent_shifts) / 6,
  }));

  const projections: MilestoneProjection[] = MILESTONE_THRESHOLDS.map(
    (threshold) => {
      const allMap = allTimeByThresholdLocation[threshold] ?? {};

      // Volunteers who haven't yet hit this milestone
      const notYetHit = volunteers.filter((v) => v.totalShifts < threshold);

      // Per-location projected counts
      const projectedByLocation: Record<string, number> = {};
      for (const loc of locations) projectedByLocation[loc] = 0;

      for (const v of notYetHit) {
        if (v.monthlyRate <= 0) continue;
        const shiftsNeeded = threshold - v.totalShifts;
        const monthsNeeded = shiftsNeeded / v.monthlyRate;
        if (monthsNeeded <= PROJECTION_MONTHS) {
          projectedByLocation[v.location] =
            (projectedByLocation[v.location] ?? 0) + 1;
        }
      }

      const byLocation: Record<
        string,
        { alreadyHit: number; projectedAdditional: number }
      > = {};
      for (const loc of locations) {
        byLocation[loc] = {
          alreadyHit: allMap[loc] ?? 0,
          projectedAdditional: projectedByLocation[loc] ?? 0,
        };
      }

      const alreadyHit = Object.values(byLocation).reduce(
        (a, b) => a + b.alreadyHit,
        0
      );
      const projectedAdditional = Object.values(byLocation).reduce(
        (a, b) => a + b.projectedAdditional,
        0
      );

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
            location: v.location,
            totalShifts: v.totalShifts,
            shiftsNeeded,
            monthlyRate: Math.round(v.monthlyRate * 10) / 10,
            projectedMonths,
          };
        })
        .sort((a, b) => a.shiftsNeeded - b.shiftsNeeded);

      return {
        threshold,
        alreadyHit,
        projectedAdditional,
        approaching,
        byLocation,
      };
    }
  );

  // ── Recent milestone achievements ─────────────────────────────────────────
  const recentAchievements: RecentMilestoneAchievement[] =
    recentAchievementsResult.map((r) => ({
      userId: r.userId,
      name: r.name ?? "Unknown",
      location: r.location,
      threshold: Number(r.threshold),
      achievedAt: r.achieved_at.toISOString(),
      totalShifts: Number(r.total_shifts),
    }));

  return {
    milestoneHits,
    distribution,
    projections,
    recentAchievements,
    locations,
  };
}
