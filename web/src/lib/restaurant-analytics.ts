import { prisma } from "@/lib/prisma";
import { nowInNZT } from "@/lib/timezone";

export interface RestaurantAnalyticsData {
  summary: {
    totalMeals: number;
    prevYearTotalMeals: number;
    yoyChangePercent: number;
    avgPerDay: number;
    prevYearAvgPerDay: number;
    totalExpected: number;
    percentOfTarget: number;
    daysWithShifts: number;
    daysWithRecords: number;
  };
  locationBreakdown: Array<{
    location: string;
    totalMeals: number;
    prevYearMeals: number;
    yoyChangePercent: number;
    avgPerDay: number;
    daysWithShifts: number;
    percentOfTarget: number;
    defaultMealsPerDay: number;
  }>;
  trendLabels: string[];
  currentYearTrend: number[];
  previousYearTrend: number[];
  hasPreviousYearData: boolean;
}

interface PeriodResult {
  byLocation: Record<
    string,
    { total: number; daysWithShifts: number; daysWithRecords: number }
  >;
  monthlyTotals: Record<string, number>;
}

function processPeriod(
  shifts: Array<{ start: Date; location: string | null }>,
  mealsRecords: Array<{ date: Date; location: string; mealsServed: number }>,
  locationDefaults: Record<string, number>
): PeriodResult {
  const locationDays: Record<string, Set<string>> = {};
  shifts.forEach((shift) => {
    const dateKey = shift.start.toISOString().substring(0, 10);
    const loc = shift.location || "Unknown";
    if (!locationDays[loc]) locationDays[loc] = new Set();
    locationDays[loc].add(dateKey);
  });

  const recordedMeals = new Map<string, number>();
  mealsRecords.forEach((r) => {
    const key = `${r.date.toISOString().substring(0, 10)}|${r.location}`;
    recordedMeals.set(key, r.mealsServed);
  });

  const byLocation: PeriodResult["byLocation"] = {};
  const monthlyTotals: Record<string, number> = {};

  Object.entries(locationDays).forEach(([loc, days]) => {
    const defaultMeals = locationDefaults[loc] || 60;
    let total = 0;
    let records = 0;

    days.forEach((dateKey) => {
      const key = `${dateKey}|${loc}`;
      const actual = recordedMeals.get(key);
      const meals = actual !== undefined ? actual : defaultMeals;
      if (actual !== undefined) records++;
      total += meals;

      const monthKey = dateKey.substring(0, 7);
      monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + meals;
    });

    byLocation[loc] = {
      total,
      daysWithShifts: days.size,
      daysWithRecords: records,
    };
  });

  return { byLocation, monthlyTotals };
}

export async function getRestaurantAnalytics(
  months: number,
  location: string | null
): Promise<RestaurantAnalyticsData> {
  const isLocationFiltered = !!location && location !== "all";
  const locations = await prisma.location.findMany({
    where: {
      isActive: true,
      ...(isLocationFiltered ? { name: location } : {}),
    },
    select: { name: true, defaultMealsServed: true },
  });

  const locationDefaults: Record<string, number> = {};
  locations.forEach((loc) => {
    locationDefaults[loc.name] = loc.defaultMealsServed;
  });

  // Current period — use NZ timezone so "today" is correct on UTC servers
  const nzNow = nowInNZT();
  const nzYear = nzNow.getFullYear();
  const nzMonth = nzNow.getMonth();
  const nzDay = nzNow.getDate();

  const endDate = new Date(nzYear, nzMonth, nzDay, 23, 59, 59, 999);
  const startDate = new Date(nzYear, nzMonth - months, nzDay);

  // Same period last year
  const prevEndDate = new Date(nzYear - 1, nzMonth, nzDay, 23, 59, 59, 999);
  const prevStartDate = new Date(nzYear - 1, nzMonth - months, nzDay);

  const locationFilter = isLocationFiltered ? { location: location! } : {};

  const [currentShifts, currentMeals, prevShifts, prevMeals] =
    await Promise.all([
      prisma.shift.findMany({
        where: { start: { gte: startDate, lte: endDate }, ...locationFilter },
        select: { start: true, location: true },
      }),
      prisma.mealsServed.findMany({
        where: { date: { gte: startDate, lte: endDate }, ...locationFilter },
      }),
      prisma.shift.findMany({
        where: {
          start: { gte: prevStartDate, lte: prevEndDate },
          ...locationFilter,
        },
        select: { start: true, location: true },
      }),
      prisma.mealsServed.findMany({
        where: {
          date: { gte: prevStartDate, lte: prevEndDate },
          ...locationFilter,
        },
      }),
    ]);

  const current = processPeriod(currentShifts, currentMeals, locationDefaults);
  const previous = processPeriod(prevShifts, prevMeals, locationDefaults);

  // Summary
  const grandTotal = Object.values(current.byLocation).reduce(
    (s, d) => s + d.total,
    0
  );
  const prevGrandTotal = Object.values(previous.byLocation).reduce(
    (s, d) => s + d.total,
    0
  );
  const totalDaysWithShifts = Object.values(current.byLocation).reduce(
    (s, d) => s + d.daysWithShifts,
    0
  );
  const totalDaysWithRecords = Object.values(current.byLocation).reduce(
    (s, d) => s + d.daysWithRecords,
    0
  );
  const prevTotalDaysWithShifts = Object.values(previous.byLocation).reduce(
    (s, d) => s + d.daysWithShifts,
    0
  );

  const totalExpected = Object.entries(current.byLocation).reduce(
    (sum, [loc, data]) => {
      return sum + (locationDefaults[loc] || 60) * data.daysWithShifts;
    },
    0
  );

  const yoyChangePercent =
    prevGrandTotal > 0
      ? Math.round(((grandTotal - prevGrandTotal) / prevGrandTotal) * 100)
      : 0;

  const summary = {
    totalMeals: grandTotal,
    prevYearTotalMeals: prevGrandTotal,
    yoyChangePercent,
    avgPerDay:
      totalDaysWithShifts > 0
        ? Math.round(grandTotal / totalDaysWithShifts)
        : 0,
    prevYearAvgPerDay:
      prevTotalDaysWithShifts > 0
        ? Math.round(prevGrandTotal / prevTotalDaysWithShifts)
        : 0,
    totalExpected,
    percentOfTarget:
      totalExpected > 0
        ? Math.round((grandTotal / totalExpected) * 100)
        : 0,
    daysWithShifts: totalDaysWithShifts,
    daysWithRecords: totalDaysWithRecords,
  };

  // Location breakdown
  const locationBreakdown = Object.entries(current.byLocation)
    .sort(([, a], [, b]) => b.total - a.total)
    .map(([loc, data]) => {
      const prevData = previous.byLocation[loc];
      const prevTotal = prevData?.total || 0;
      const expected = (locationDefaults[loc] || 60) * data.daysWithShifts;
      return {
        location: loc,
        totalMeals: data.total,
        prevYearMeals: prevTotal,
        yoyChangePercent:
          prevTotal > 0
            ? Math.round(((data.total - prevTotal) / prevTotal) * 100)
            : 0,
        avgPerDay:
          data.daysWithShifts > 0
            ? Math.round(data.total / data.daysWithShifts)
            : 0,
        daysWithShifts: data.daysWithShifts,
        percentOfTarget:
          expected > 0 ? Math.round((data.total / expected) * 100) : 0,
        defaultMealsPerDay: locationDefaults[loc] || 60,
      };
    });

  // Monthly trends — generate all month keys in current period
  const monthKeys: string[] = [];
  {
    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    while (cursor <= endMonth) {
      monthKeys.push(
        `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`
      );
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  const trendLabels = monthKeys.map((m) => {
    const [year, month] = m.split("-");
    const d = new Date(parseInt(year), parseInt(month) - 1, 1);
    return d.toLocaleDateString("en-NZ", { month: "short" });
  });

  const currentYearTrend = monthKeys.map(
    (m) => current.monthlyTotals[m] || 0
  );

  const previousYearTrend = monthKeys.map((m) => {
    const [year, month] = m.split("-");
    const prevKey = `${parseInt(year) - 1}-${month}`;
    return previous.monthlyTotals[prevKey] || 0;
  });

  const hasPreviousYearData = previousYearTrend.some((v) => v > 0);

  return {
    summary,
    locationBreakdown,
    trendLabels,
    currentYearTrend,
    previousYearTrend,
    hasPreviousYearData,
  };
}
