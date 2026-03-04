import { prisma } from "@/lib/prisma";

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

  const volunteers = await prisma.user.findMany({
    where: { role: "VOLUNTEER" },
    select: {
      id: true,
      signups: {
        where: { status: "CONFIRMED" },
        select: {
          shift: {
            select: { end: true, location: true },
          },
        },
      },
    },
  });

  let activeCount = 0;
  let highlyActiveCount = 0;
  let inactiveCount = 0;
  let neverVolunteeredCount = 0;
  let newInPeriodCount = 0;

  const monthlyActiveMap = new Map<string, Set<string>>();

  for (let i = 0; i < 12; i++) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyActiveMap.set(key, new Set());
  }

  for (const volunteer of volunteers) {
    const completedSignups = volunteer.signups.filter((s) => {
      const isPast = s.shift.end < now;
      const matchesLocation =
        !location || location === "all" || s.shift.location === location;
      return isPast && matchesLocation;
    });

    const shiftsInPeriod = completedSignups.filter(
      (s) => s.shift.end >= periodStart
    );
    const totalCompleted = completedSignups.length;

    if (totalCompleted === 0) {
      neverVolunteeredCount++;
      continue;
    }

    for (const signup of completedSignups) {
      const end = signup.shift.end;
      const monthKey = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}`;
      const monthSet = monthlyActiveMap.get(monthKey);
      if (monthSet) {
        monthSet.add(volunteer.id);
      }
    }

    if (shiftsInPeriod.length === 0) {
      inactiveCount++;
    } else {
      const firstCompletedDate = completedSignups.reduce(
        (earliest, s) =>
          s.shift.end < earliest ? s.shift.end : earliest,
        completedSignups[0].shift.end
      );
      if (firstCompletedDate >= periodStart) {
        newInPeriodCount++;
      }

      const avgPerMonth = shiftsInPeriod.length / months;
      if (avgPerMonth >= 2) {
        highlyActiveCount++;
      } else {
        activeCount++;
      }
    }
  }

  const monthlyTrend = Array.from(monthlyActiveMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, vols]) => ({
      month,
      activeVolunteers: vols.size,
    }));

  const priorStart = new Date(periodStart);
  priorStart.setMonth(priorStart.getMonth() - months);

  let priorActiveCount = 0;
  let retainedCount = 0;

  for (const volunteer of volunteers) {
    const completedSignups = volunteer.signups.filter((s) => {
      const isPast = s.shift.end < now;
      const matchesLocation =
        !location || location === "all" || s.shift.location === location;
      return isPast && matchesLocation;
    });

    const inPriorPeriod = completedSignups.some(
      (s) => s.shift.end >= priorStart && s.shift.end < periodStart
    );
    const inCurrentPeriod = completedSignups.some(
      (s) => s.shift.end >= periodStart
    );

    if (inPriorPeriod) {
      priorActiveCount++;
      if (inCurrentPeriod) {
        retainedCount++;
      }
    }
  }

  const retentionRate =
    priorActiveCount > 0
      ? Math.round((retainedCount / priorActiveCount) * 100)
      : 0;

  const totalVolunteers = volunteers.length;

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
