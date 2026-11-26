import { prisma } from "@/lib/prisma";
import { SERVICE_NIGHTS_ONLY } from "@/lib/day-reports";
import { formatInNZT } from "@/lib/timezone";
import {
  budgetStatus,
  budgetYearOf,
  budgetYearRange,
  computeBudgetProgress,
  computeRangeProgress,
  currentBudgetYear,
  nightlyTargetFor,
  sumRangeProgress,
  yearElapsedRatio,
  type BudgetProgress,
  type BudgetStatus,
  type RangeProgress,
} from "@/lib/budget-calculations";
import {
  budgetPeriodBounds,
  budgetYearsInPeriod,
  type BudgetPeriod,
} from "@/lib/budget-periods";

export interface BudgetNight {
  /** NZ service date, yyyy-MM-dd */
  date: string;
  guests: number | null;
  /** Koha banked (cash + EFTPOS + Stripe); null while nothing is recorded. */
  actual: number | null;
  target: number | null;
  status: BudgetStatus | null;
}

export interface LocationBudgetSummary {
  locationId: string;
  location: string;
  /** The budget for the financial year in view (`BudgetTrackingData.year`). */
  budget: {
    annualTarget: number;
    plannedServiceNights: number;
    updatedAt: string;
  } | null;
  /** Year-to-date progress against that budget. */
  progress: BudgetProgress | null;
  /**
   * Koha against target over a week, month or custom period. Null in the
   * financial year view, and when no budget covers any night of the period.
   */
  range: RangeProgress | null;
  /** Nights in the period with guests but no koha yet - left out of totals. */
  pendingNights: number;
  lastNightHeld: string | null;
}

export interface BudgetTrackingData {
  period: BudgetPeriod;
  /** The financial year in view: picked, or the one the period ends in. */
  year: number;
  /** Years offered in the year picker, newest first. */
  years: number[];
  /** Today in NZ, yyyy-MM-dd */
  today: string;
  /** Where today sits in the financial year in view. */
  timing: "past" | "current" | "future";
  yearElapsedRatio: number;
  locations: LocationBudgetSummary[];
  /** Year-to-date sums across the locations that have a budget for the year. */
  totals: {
    budgetedLocations: number;
    annualTarget: number;
    ytdActual: number;
    ytdTarget: number;
    plannedServiceNights: number;
    nightsHeld: number;
  };
  /** Period sums across the locations with a budget covering it; null for a year. */
  rangeTotals: (RangeProgress & { budgetedLocations: number }) | null;
  /** Night-by-night detail for the period when one location is selected. */
  selected: (LocationBudgetSummary & { nights: BudgetNight[] }) | null;
}

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function getBudgetTracking(
  period: BudgetPeriod,
  locationName: string | null
): Promise<BudgetTrackingData> {
  const { year } = period;
  const isYear = period.kind === "year";
  const now = new Date();
  const currentYear = currentBudgetYear(now);
  const yearSpan = { start: `${year - 1}-04-01`, end: `${year}-03-31` };

  // The year in view always loads (for year-to-date figures), plus every year
  // the period touches so each night is scored against its own year's budget.
  const budgetYears = Array.from(
    new Set([year, ...budgetYearsInPeriod(period)])
  );
  const yearBounds = budgetYearRange(year);
  const periodBounds = budgetPeriodBounds(period);
  const fetchStart = new Date(
    Math.min(yearBounds.start.getTime(), periodBounds.start.getTime())
  );
  const fetchEnd = new Date(
    Math.max(yearBounds.end.getTime(), periodBounds.end.getTime())
  );

  // Active venues, plus any disabled venue that still has a budget in view.
  const [locations, earliestNight, savedBudgetYears] = await Promise.all([
    prisma.location.findMany({
      where: {
        OR: [
          { isActive: true },
          { budgets: { some: { year: { in: budgetYears } } } },
        ],
      },
      select: {
        id: true,
        name: true,
        budgets: { where: { year: { in: budgetYears } } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.mealsServed.aggregate({
      where: SERVICE_NIGHTS_ONLY,
      _min: { date: true },
    }),
    prisma.locationBudget.findMany({
      distinct: ["year"],
      select: { year: true },
    }),
  ]);

  const names = locations.map((l) => l.name);
  const records = await prisma.mealsServed.findMany({
    // Only service nights are koha against the budget.
    where: {
      ...SERVICE_NIGHTS_ONLY,
      date: { gte: fetchStart, lt: fetchEnd },
      location: { in: names },
    },
    select: {
      date: true,
      location: true,
      mealsServed: true,
      cash: true,
      eftpos: true,
      stripe: true,
    },
    orderBy: { date: "asc" },
  });

  const recordsByLocation = new Map<string, typeof records>();
  for (const r of records) {
    const list = recordsByLocation.get(r.location);
    if (list) list.push(r);
    else recordsByLocation.set(r.location, [r]);
  }

  const summaries = locations.map((loc) => {
    const nightlyTargetByYear = new Map(
      loc.budgets.map((b) => [
        b.year,
        nightlyTargetFor({
          annualTarget: Number(b.annualTarget),
          plannedServiceNights: b.plannedServiceNights,
        }),
      ])
    );
    const raw = loc.budgets.find((b) => b.year === year);
    const budget = raw
      ? {
          annualTarget: Number(raw.annualTarget),
          plannedServiceNights: raw.plannedServiceNights,
          updatedAt: raw.updatedAt.toISOString(),
        }
      : null;

    const allNights: BudgetNight[] = (recordsByLocation.get(loc.name) ?? []).map(
      (r) => {
        const banked = r.cash !== null || r.eftpos !== null || r.stripe !== null;
        const actual = banked
          ? toNum(r.cash) + toNum(r.eftpos) + toNum(r.stripe)
          : null;
        const target = nightlyTargetByYear.get(budgetYearOf(r.date)) ?? null;
        return {
          date: formatInNZT(r.date, "yyyy-MM-dd"),
          guests: r.mealsServed,
          actual,
          target,
          status:
            actual !== null && target !== null
              ? budgetStatus(actual, target)
              : null,
        };
      }
    );
    const within = (span: { start: string; end: string }) =>
      allNights.filter((n) => n.date >= span.start && n.date <= span.end);
    const isHeld = (n: BudgetNight): n is BudgetNight & { actual: number } =>
      n.actual !== null;

    const nights = within(period);
    const held = nights.filter(isHeld);
    const yearHeld = isYear ? held : within(yearSpan).filter(isHeld);
    const periodHasBudget = budgetYearsInPeriod(period).some((y) =>
      nightlyTargetByYear.has(y)
    );

    const summary: LocationBudgetSummary = {
      locationId: loc.id,
      location: loc.name,
      budget,
      progress: budget
        ? computeBudgetProgress(
            budget,
            yearHeld.map((n) => n.actual)
          )
        : null,
      range:
        !isYear && periodHasBudget
          ? computeRangeProgress(
              held.map((n) => ({ actual: n.actual, target: n.target }))
            )
          : null,
      pendingNights: nights.length - held.length,
      lastNightHeld: held.at(-1)?.date ?? null,
    };
    return { summary, nights };
  });

  const budgeted = summaries
    .map((s) => s.summary)
    .filter((s) => s.progress !== null);
  const totals = {
    budgetedLocations: budgeted.length,
    annualTarget: budgeted.reduce((t, s) => t + s.progress!.annualTarget, 0),
    ytdActual: budgeted.reduce((t, s) => t + s.progress!.ytdActual, 0),
    ytdTarget: budgeted.reduce((t, s) => t + s.progress!.ytdTarget, 0),
    plannedServiceNights: budgeted.reduce(
      (t, s) => t + s.progress!.plannedServiceNights,
      0
    ),
    nightsHeld: budgeted.reduce((t, s) => t + s.progress!.nightsHeld, 0),
  };

  const ranged = summaries
    .map((s) => s.summary.range)
    .filter((r): r is RangeProgress => r !== null);
  const rangeTotals = isYear
    ? null
    : { ...sumRangeProgress(ranged), budgetedLocations: ranged.length };

  // Year picker: every year from the first recorded night (or budget) to next
  // year, so admins can set next year's budget ahead of time.
  const firstYear = Math.min(
    earliestNight._min.date ? budgetYearOf(earliestNight._min.date) : currentYear,
    ...savedBudgetYears.map((b) => b.year),
    currentYear,
    year
  );
  const lastYear = Math.max(currentYear + 1, year);
  const years: number[] = [];
  for (let y = lastYear; y >= firstYear; y--) years.push(y);

  const selectedEntry = locationName
    ? summaries.find((s) => s.summary.location === locationName)
    : undefined;

  return {
    period,
    year,
    years,
    today: formatInNZT(now, "yyyy-MM-dd"),
    timing:
      year < currentYear ? "past" : year > currentYear ? "future" : "current",
    yearElapsedRatio: yearElapsedRatio(year, now),
    locations: summaries.map((s) => s.summary),
    totals,
    rangeTotals,
    selected: selectedEntry
      ? { ...selectedEntry.summary, nights: selectedEntry.nights }
      : null,
  };
}
