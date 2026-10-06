import { prisma } from "@/lib/prisma";
import { formatInNZT } from "@/lib/timezone";
import {
  budgetStatus,
  budgetYearOf,
  budgetYearRange,
  computeBudgetProgress,
  currentBudgetYear,
  yearElapsedRatio,
  type BudgetProgress,
  type BudgetStatus,
} from "@/lib/budget-calculations";

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
  budget: {
    annualTarget: number;
    plannedServiceNights: number;
    updatedAt: string;
  } | null;
  progress: BudgetProgress | null;
  /** Nights recorded with guests but no koha yet - left out of YTD. */
  pendingNights: number;
  lastNightHeld: string | null;
}

export interface BudgetTrackingData {
  year: number;
  /** Years offered in the year picker, newest first. */
  years: number[];
  /** Today in NZ, yyyy-MM-dd */
  today: string;
  timing: "past" | "current" | "future";
  yearElapsedRatio: number;
  locations: LocationBudgetSummary[];
  /** Sums across the locations that have a budget for the year. */
  totals: {
    budgetedLocations: number;
    annualTarget: number;
    ytdActual: number;
    ytdTarget: number;
    plannedServiceNights: number;
    nightsHeld: number;
  };
  /** Night-by-night detail when one location is selected. */
  selected: (LocationBudgetSummary & { nights: BudgetNight[] }) | null;
}

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function getBudgetTracking(
  year: number,
  locationName: string | null
): Promise<BudgetTrackingData> {
  const { start, end } = budgetYearRange(year);
  const now = new Date();
  const currentYear = currentBudgetYear(now);

  // Active venues, plus any disabled venue that still has a budget this year.
  const [locations, earliestNight, budgetYears] = await Promise.all([
    prisma.location.findMany({
      where: {
        OR: [{ isActive: true }, { budgets: { some: { year } } }],
      },
      select: {
        id: true,
        name: true,
        budgets: { where: { year } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.mealsServed.aggregate({ _min: { date: true } }),
    prisma.locationBudget.findMany({
      distinct: ["year"],
      select: { year: true },
    }),
  ]);

  const names = locations.map((l) => l.name);
  const records = await prisma.mealsServed.findMany({
    where: { date: { gte: start, lt: end }, location: { in: names } },
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
    const raw = loc.budgets[0];
    const budget = raw
      ? {
          annualTarget: Number(raw.annualTarget),
          plannedServiceNights: raw.plannedServiceNights,
          updatedAt: raw.updatedAt.toISOString(),
        }
      : null;
    const nightlyTarget =
      budget && budget.plannedServiceNights > 0
        ? budget.annualTarget / budget.plannedServiceNights
        : null;

    const nights: BudgetNight[] = (recordsByLocation.get(loc.name) ?? []).map(
      (r) => {
        const banked = r.cash !== null || r.eftpos !== null || r.stripe !== null;
        const actual = banked
          ? toNum(r.cash) + toNum(r.eftpos) + toNum(r.stripe)
          : null;
        return {
          date: formatInNZT(r.date, "yyyy-MM-dd"),
          guests: r.mealsServed,
          actual,
          target: nightlyTarget,
          status:
            actual !== null && nightlyTarget !== null
              ? budgetStatus(actual, nightlyTarget)
              : null,
        };
      }
    );

    const held = nights.filter((n) => n.actual !== null);
    const summary: LocationBudgetSummary = {
      locationId: loc.id,
      location: loc.name,
      budget,
      progress: budget
        ? computeBudgetProgress(
            budget,
            held.map((n) => n.actual as number)
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

  // Year picker: every year from the first recorded night (or budget) to next
  // year, so admins can set next year's budget ahead of time.
  const firstYear = Math.min(
    earliestNight._min.date ? budgetYearOf(earliestNight._min.date) : currentYear,
    ...budgetYears.map((b) => b.year),
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
    year,
    years,
    today: formatInNZT(now, "yyyy-MM-dd"),
    timing:
      year < currentYear ? "past" : year > currentYear ? "future" : "current",
    yearElapsedRatio: yearElapsedRatio(year, now),
    locations: summaries.map((s) => s.summary),
    totals,
    selected: selectedEntry
      ? { ...selectedEntry.summary, nights: selectedEntry.nights }
      : null,
  };
}
