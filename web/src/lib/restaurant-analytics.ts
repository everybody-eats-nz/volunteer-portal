import { prisma } from "@/lib/prisma";
import { nowInNZT, toNZT } from "@/lib/timezone";

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
  weeklyLabels: string[];
  currentYearWeekly: number[];
  previousYearWeekly: number[];
  hasPreviousYearData: boolean;
  // Service-night stats aggregated from recorded MealsServed entries
  serviceStats: {
    recordedNights: number;
    totalCustomers: number; // sum of recorded customers (mealsServed)
    totalKoha: number;
    prevTotalKoha: number;
    kohaYoyPercent: number;
    cash: number;
    eftpos: number;
    stripe: number;
    perHead: number | null; // koha ÷ customers on nights with koha
    perPaying: number | null; // koha ÷ (customers − non-paying) on koha nights
    newVolunteers: number;
    nonPayingCount: number;
    nonPayingPercent: number | null;
    takeaways: number;
    vege: number;
    bookingsPax: number;
    eftposTransactions: number;
    kohaTarget: number; // Σ per-location target × nights with koha
    kohaTargetPercent: number | null; // totalKoha ÷ kohaTarget
  };
  kohaTrend: number[]; // monthly total koha, aligned to trendLabels
  kohaStreamTrend: {
    cash: number[];
    eftpos: number[];
    stripe: number[];
  };
  kohaTargetTrend: number[]; // monthly koha target, aligned to trendLabels
  proteinMix: Array<{ label: string; nights: number }>;
  weatherMix: Array<{ label: string; nights: number }>;
  hasServiceStats: boolean;
  hasKohaTarget: boolean;
}

interface PeriodResult {
  byLocation: Record<
    string,
    { total: number; daysWithShifts: number; daysWithRecords: number }
  >;
  monthlyTotals: Record<string, number>;
  weeklyTotals: Record<string, number>;
}

function processPeriod(
  shifts: Array<{ start: Date; location: string | null }>,
  mealsRecords: Array<{
    date: Date;
    location: string;
    mealsServed: number | null;
  }>,
  locationDefaults: Record<string, number>,
  daysFilter: number[] | null
): PeriodResult {
  const locationDays: Record<string, Set<string>> = {};
  shifts.forEach((shift) => {
    // Use NZT day of week for filtering
    if (daysFilter) {
      const nzDay = toNZT(shift.start).getDay();
      if (!daysFilter.includes(nzDay)) return;
    }
    const dateKey = shift.start.toISOString().substring(0, 10);
    const loc = shift.location || "Unknown";
    if (!locationDays[loc]) locationDays[loc] = new Set();
    locationDays[loc].add(dateKey);
  });

  const recordedMeals = new Map<string, number>();
  mealsRecords.forEach((r) => {
    if (r.mealsServed === null) return;
    const key = `${r.date.toISOString().substring(0, 10)}|${r.location}`;
    recordedMeals.set(key, r.mealsServed);
  });

  const byLocation: PeriodResult["byLocation"] = {};
  const monthlyTotals: Record<string, number> = {};
  const weeklyTotals: Record<string, number> = {};

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

      // ISO week key: Monday of the week containing this date
      const d = new Date(dateKey + "T00:00:00");
      const day = d.getDay();
      const monday = new Date(d);
      monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
      const weekKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
      weeklyTotals[weekKey] = (weeklyTotals[weekKey] || 0) + meals;
    });

    byLocation[loc] = {
      total,
      daysWithShifts: days.size,
      daysWithRecords: records,
    };
  });

  return { byLocation, monthlyTotals, weeklyTotals };
}

// A recorded service night — only the fields the stats aggregation needs.
interface NightRecord {
  date: Date;
  location: string;
  mealsServed: number | null;
  newVolunteers: number | null;
  nonPayingCount: number | null;
  vege: number | null;
  takeaways: number | null;
  bookingsPax: number | null;
  eftposTransactions: number | null;
  cash: unknown; // Prisma.Decimal | null
  eftpos: unknown;
  stripe: unknown;
  protein: string | null;
  weather: string | null;
}

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function aggregateNightStats(
  records: NightRecord[],
  daysFilter: number[] | null,
  locationTargets: Record<string, number> = {}
) {
  const agg = {
    recordedNights: 0,
    totalCustomers: 0,
    totalKoha: 0,
    cash: 0,
    eftpos: 0,
    stripe: 0,
    customersWithKoha: 0,
    nonPayingWithKoha: 0,
    newVolunteers: 0,
    nonPayingCount: 0,
    takeaways: 0,
    vege: 0,
    bookingsPax: 0,
    eftposTransactions: 0,
    totalTarget: 0,
    proteinCounts: {} as Record<string, number>,
    weatherCounts: {} as Record<string, number>,
    monthlyKoha: {} as Record<string, number>,
    monthlyCash: {} as Record<string, number>,
    monthlyEftpos: {} as Record<string, number>,
    monthlyStripe: {} as Record<string, number>,
    monthlyTarget: {} as Record<string, number>,
  };

  records.forEach((r) => {
    if (daysFilter) {
      const nzDay = toNZT(r.date).getDay();
      if (!daysFilter.includes(nzDay)) return;
    }
    agg.recordedNights++;
    agg.totalCustomers += r.mealsServed ?? 0;

    const cash = toNum(r.cash);
    const eftpos = toNum(r.eftpos);
    const stripe = toNum(r.stripe);
    const koha = cash + eftpos + stripe;
    agg.cash += cash;
    agg.eftpos += eftpos;
    agg.stripe += stripe;
    agg.totalKoha += koha;

    if (koha > 0) {
      agg.customersWithKoha += r.mealsServed ?? 0;
      agg.nonPayingWithKoha += r.nonPayingCount ?? 0;
      const monthKey = r.date.toISOString().substring(0, 7);
      agg.monthlyKoha[monthKey] = (agg.monthlyKoha[monthKey] || 0) + koha;
      agg.monthlyCash[monthKey] = (agg.monthlyCash[monthKey] || 0) + cash;
      agg.monthlyEftpos[monthKey] = (agg.monthlyEftpos[monthKey] || 0) + eftpos;
      agg.monthlyStripe[monthKey] = (agg.monthlyStripe[monthKey] || 0) + stripe;
      const target = locationTargets[r.location] || 0;
      agg.totalTarget += target;
      agg.monthlyTarget[monthKey] = (agg.monthlyTarget[monthKey] || 0) + target;
    }

    agg.newVolunteers += r.newVolunteers ?? 0;
    agg.nonPayingCount += r.nonPayingCount ?? 0;
    agg.takeaways += r.takeaways ?? 0;
    agg.vege += r.vege ?? 0;
    agg.bookingsPax += r.bookingsPax ?? 0;
    agg.eftposTransactions += r.eftposTransactions ?? 0;

    if (r.protein) {
      agg.proteinCounts[r.protein] = (agg.proteinCounts[r.protein] || 0) + 1;
    }
    if (r.weather) {
      const condition = r.weather.split(",")[0].trim();
      if (condition) {
        agg.weatherCounts[condition] =
          (agg.weatherCounts[condition] || 0) + 1;
      }
    }
  });

  return agg;
}

export async function getRestaurantAnalytics(
  months: number,
  location: string | null,
  daysFilter: number[] | null = null,
  from: string | null = null,
  to: string | null = null
): Promise<RestaurantAnalyticsData> {
  // Custom date range overrides the month preset when both ends are valid.
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const customRange =
    from && to && dateRe.test(from) && dateRe.test(to) && from <= to
      ? { from, to }
      : null;
  const isLocationFiltered = !!location && location !== "all";
  const locations = await prisma.location.findMany({
    where: {
      isActive: true,
      ...(isLocationFiltered ? { name: location } : {}),
    },
    select: { name: true, defaultMealsServed: true, targetPerNight: true },
  });

  const locationDefaults: Record<string, number> = {};
  const locationTargets: Record<string, number> = {};
  locations.forEach((loc) => {
    locationDefaults[loc.name] = loc.defaultMealsServed;
    if (loc.targetPerNight !== null) {
      locationTargets[loc.name] = Number(loc.targetPerNight);
    }
  });

  // Current period — use NZ timezone so "today" is correct on UTC servers.
  // Dates are constructed in server-local time (TZ=Pacific/Auckland) so they
  // represent NZ day boundaries.
  let startDate: Date;
  let endDate: Date;
  if (customRange) {
    startDate = new Date(`${customRange.from}T00:00:00`);
    endDate = new Date(`${customRange.to}T23:59:59.999`);
  } else {
    const nzNow = nowInNZT();
    endDate = new Date(
      nzNow.getFullYear(),
      nzNow.getMonth(),
      nzNow.getDate(),
      23,
      59,
      59,
      999
    );
    startDate = new Date(
      nzNow.getFullYear(),
      nzNow.getMonth() - months,
      nzNow.getDate()
    );
  }

  // Same period last year (shift both ends back a year)
  const prevStartDate = new Date(startDate);
  prevStartDate.setFullYear(prevStartDate.getFullYear() - 1);
  const prevEndDate = new Date(endDate);
  prevEndDate.setFullYear(prevEndDate.getFullYear() - 1);

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

  const current = processPeriod(currentShifts, currentMeals, locationDefaults, daysFilter);
  const previous = processPeriod(prevShifts, prevMeals, locationDefaults, daysFilter);

  // Service-night stats (donations, volunteers, protein/weather mix, …)
  const stats = aggregateNightStats(currentMeals, daysFilter, locationTargets);
  const prevStats = aggregateNightStats(prevMeals, daysFilter, locationTargets);

  const payingCustomers = stats.customersWithKoha - stats.nonPayingWithKoha;
  const serviceStats = {
    recordedNights: stats.recordedNights,
    totalCustomers: stats.totalCustomers,
    totalKoha: Math.round(stats.totalKoha * 100) / 100,
    prevTotalKoha: Math.round(prevStats.totalKoha * 100) / 100,
    kohaYoyPercent:
      prevStats.totalKoha > 0
        ? Math.round(
            ((stats.totalKoha - prevStats.totalKoha) / prevStats.totalKoha) *
              100
          )
        : 0,
    cash: Math.round(stats.cash * 100) / 100,
    eftpos: Math.round(stats.eftpos * 100) / 100,
    stripe: Math.round(stats.stripe * 100) / 100,
    perHead:
      stats.customersWithKoha > 0
        ? Math.round((stats.totalKoha / stats.customersWithKoha) * 100) / 100
        : null,
    perPaying:
      payingCustomers > 0
        ? Math.round((stats.totalKoha / payingCustomers) * 100) / 100
        : null,
    newVolunteers: stats.newVolunteers,
    nonPayingCount: stats.nonPayingCount,
    nonPayingPercent:
      stats.totalCustomers > 0
        ? Math.round((stats.nonPayingCount / stats.totalCustomers) * 100)
        : null,
    takeaways: stats.takeaways,
    vege: stats.vege,
    bookingsPax: stats.bookingsPax,
    eftposTransactions: stats.eftposTransactions,
    kohaTarget: Math.round(stats.totalTarget * 100) / 100,
    kohaTargetPercent:
      stats.totalTarget > 0
        ? Math.round((stats.totalKoha / stats.totalTarget) * 100)
        : null,
  };

  const hasKohaTarget = stats.totalTarget > 0;

  const proteinMix = Object.entries(stats.proteinCounts)
    .map(([label, nights]) => ({ label, nights }))
    .sort((a, b) => b.nights - a.nights);
  const weatherMix = Object.entries(stats.weatherCounts)
    .map(([label, nights]) => ({ label, nights }))
    .sort((a, b) => b.nights - a.nights);
  const hasServiceStats = stats.recordedNights > 0;

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

  // Monthly koha totals, aligned to the same month buckets as the meals trend
  const kohaTrend = monthKeys.map((m) =>
    Math.round(stats.monthlyKoha[m] || 0)
  );
  const kohaStreamTrend = {
    cash: monthKeys.map((m) => Math.round(stats.monthlyCash[m] || 0)),
    eftpos: monthKeys.map((m) => Math.round(stats.monthlyEftpos[m] || 0)),
    stripe: monthKeys.map((m) => Math.round(stats.monthlyStripe[m] || 0)),
  };
  const kohaTargetTrend = monthKeys.map((m) =>
    Math.round(stats.monthlyTarget[m] || 0)
  );

  const previousYearTrend = monthKeys.map((m) => {
    const [year, month] = m.split("-");
    const prevKey = `${parseInt(year) - 1}-${month}`;
    return previous.monthlyTotals[prevKey] || 0;
  });

  // Weekly trends — generate all week keys (Monday dates) in current period
  const weekKeys: string[] = [];
  {
    // Start from the Monday on or before startDate
    const cursor = new Date(startDate);
    const day = cursor.getDay();
    cursor.setDate(cursor.getDate() - (day === 0 ? 6 : day - 1));
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= endDate) {
      weekKeys.push(
        `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`
      );
      cursor.setDate(cursor.getDate() + 7);
    }
  }

  const weeklyLabels = weekKeys.map((w) => {
    const d = new Date(w + "T00:00:00");
    return d.toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
  });

  const currentYearWeekly = weekKeys.map(
    (w) => current.weeklyTotals[w] || 0
  );

  const previousYearWeekly = weekKeys.map((w) => {
    const d = new Date(w + "T00:00:00");
    d.setFullYear(d.getFullYear() - 1);
    const prevKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return previous.weeklyTotals[prevKey] || 0;
  });

  const hasPreviousYearData =
    previousYearTrend.some((v) => v > 0) ||
    previousYearWeekly.some((v) => v > 0);

  return {
    summary,
    locationBreakdown,
    trendLabels,
    currentYearTrend,
    previousYearTrend,
    weeklyLabels,
    currentYearWeekly,
    previousYearWeekly,
    hasPreviousYearData,
    serviceStats,
    kohaTrend,
    kohaStreamTrend,
    kohaTargetTrend,
    proteinMix,
    weatherMix,
    hasServiceStats,
    hasKohaTarget,
  };
}
