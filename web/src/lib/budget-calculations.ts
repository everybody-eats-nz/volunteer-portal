import { TZDate } from "@date-fns/tz";
import { toNZT } from "@/lib/timezone";

/**
 * Pure budget-tracking maths shared by the budget analytics page, the
 * restaurant analytics koha-vs-target figures and the locations admin.
 *
 * Budget years are Everybody Eats financial years: 1 April - 31 March,
 * Pacific/Auckland. A year is numbered by the March it ends in, the NZ
 * convention, so budget year 2027 runs 1 Apr 2026 - 31 Mar 2027 and is shown
 * as "2026/27". `budgetYearRange` and `budgetYearOf` are the only places that
 * encode the boundaries.
 */

const NZ_TZ = "Pacific/Auckland";

/** A night at or above this share of its target is green. */
export const ON_TARGET_RATIO = 1;
/** A night at or above this share (but under target) is yellow; below is red. */
export const CLOSE_TO_TARGET_RATIO = 0.9;

export type BudgetStatus = "green" | "yellow" | "red";

export interface BudgetInput {
  annualTarget: number;
  plannedServiceNights: number;
}

/** Month (0-based) the budget year starts in: April. */
const BUDGET_YEAR_START_MONTH = 3;

/** First instant of the budget year and first instant of the next one (NZ). */
export function budgetYearRange(year: number): { start: Date; end: Date } {
  return {
    start: new Date(
      new TZDate(year - 1, BUDGET_YEAR_START_MONTH, 1, NZ_TZ).getTime()
    ),
    end: new Date(new TZDate(year, BUDGET_YEAR_START_MONTH, 1, NZ_TZ).getTime()),
  };
}

/** The budget year a service night (or any instant) belongs to. */
export function budgetYearOf(date: Date): number {
  const nz = toNZT(date);
  return nz.getMonth() >= BUDGET_YEAR_START_MONTH
    ? nz.getFullYear() + 1
    : nz.getFullYear();
}

/** The budget year in progress right now. */
export function currentBudgetYear(now: Date = new Date()): number {
  return budgetYearOf(now);
}

/** Short label for a budget year: 2027 → "2026/27". */
export function budgetYearLabel(year: number): string {
  return `${year - 1}/${String(year % 100).padStart(2, "0")}`;
}

/** The dates a budget year covers: 2027 → "1 Apr 2026 – 31 Mar 2027". */
export function budgetYearSpan(year: number): string {
  return `1 Apr ${year - 1} – 31 Mar ${year}`;
}

/** Share of the budget year that has elapsed at `now`, clamped to 0..1. */
export function yearElapsedRatio(year: number, now: Date): number {
  const { start, end } = budgetYearRange(year);
  const ratio =
    (now.getTime() - start.getTime()) / (end.getTime() - start.getTime());
  return Math.min(1, Math.max(0, ratio));
}

/** Annual target spread evenly over the planned service nights. */
export function nightlyTargetFor(budget: BudgetInput): number | null {
  if (budget.plannedServiceNights <= 0) return null;
  return budget.annualTarget / budget.plannedServiceNights;
}

/** Red / yellow / green for an actual against a target. */
export function budgetStatus(actual: number, target: number): BudgetStatus {
  if (target <= 0) return "green";
  const ratio = actual / target;
  if (ratio >= ON_TARGET_RATIO) return "green";
  if (ratio >= CLOSE_TO_TARGET_RATIO) return "yellow";
  return "red";
}

/**
 * Whole-percent display of a ratio, rounded DOWN so the number never
 * contradicts the colour (89.6% shows as 89%, red - not 90%, yellow).
 */
export function ratioToPercent(ratio: number): number {
  return Math.floor(ratio * 100 + 1e-9);
}

export interface BudgetProgress {
  annualTarget: number;
  plannedServiceNights: number;
  nightlyTarget: number | null;
  /** Service nights with koha recorded so far this budget year. */
  nightsHeld: number;
  ytdActual: number;
  /** Pro-rata target: the nightly target for every night held so far. */
  ytdTarget: number;
  /** ytdActual − ytdTarget (negative = behind). */
  ytdVariance: number;
  ytdRatio: number | null;
  ytdStatus: BudgetStatus | null;
  /** ytdActual ÷ annualTarget. */
  annualRatio: number | null;
  remainingNights: number;
  /** What is still to raise to hit the annual target (never negative). */
  remainingTarget: number;
  /**
   * Average koha needed on each remaining planned night to hit budget.
   * 0 once the budget is met; null when nights have run out short of it.
   */
  avgNeededPerRemaining: number | null;
  /** Actual average koha per night held so far. */
  avgActualPerNight: number | null;
  /** Year-end estimate if the remaining nights match the average so far. */
  projectedYearEnd: number;
  budgetMet: boolean;
  statusCounts: Record<BudgetStatus, number>;
}

/**
 * Year-to-date progress for one location's budget, from the koha actually
 * banked on each night held so far.
 */
export function computeBudgetProgress(
  budget: BudgetInput,
  nightActuals: number[]
): BudgetProgress {
  const { annualTarget, plannedServiceNights } = budget;
  const nightlyTarget = nightlyTargetFor(budget);

  const nightsHeld = nightActuals.length;
  const ytdActual = nightActuals.reduce((sum, v) => sum + v, 0);
  const ytdTarget = (nightlyTarget ?? 0) * nightsHeld;

  const statusCounts: Record<BudgetStatus, number> = {
    green: 0,
    yellow: 0,
    red: 0,
  };
  if (nightlyTarget !== null) {
    for (const actual of nightActuals) {
      statusCounts[budgetStatus(actual, nightlyTarget)]++;
    }
  }

  const remainingNights = Math.max(0, plannedServiceNights - nightsHeld);
  const remainingTarget = Math.max(0, annualTarget - ytdActual);
  const budgetMet = annualTarget > 0 && ytdActual >= annualTarget;

  let avgNeededPerRemaining: number | null;
  if (remainingTarget === 0) avgNeededPerRemaining = 0;
  else if (remainingNights === 0) avgNeededPerRemaining = null;
  else avgNeededPerRemaining = remainingTarget / remainingNights;

  const avgActualPerNight = nightsHeld > 0 ? ytdActual / nightsHeld : null;

  return {
    annualTarget,
    plannedServiceNights,
    nightlyTarget,
    nightsHeld,
    ytdActual,
    ytdTarget,
    ytdVariance: ytdActual - ytdTarget,
    ytdRatio: ytdTarget > 0 ? ytdActual / ytdTarget : null,
    ytdStatus: ytdTarget > 0 ? budgetStatus(ytdActual, ytdTarget) : null,
    annualRatio: annualTarget > 0 ? ytdActual / annualTarget : null,
    remainingNights,
    remainingTarget,
    avgNeededPerRemaining,
    avgActualPerNight,
    projectedYearEnd: ytdActual + (avgActualPerNight ?? 0) * remainingNights,
    budgetMet,
    statusCounts,
  };
}

export interface RangeNight {
  /** Koha banked that night. */
  actual: number;
  /** The night's target from its own year's budget; null when that year has none. */
  target: number | null;
}

export interface RangeProgress {
  /** Service nights with koha banked in the range. */
  nightsHeld: number;
  /** All koha banked in the range. */
  actual: number;
  /** Nights held that have a target (their financial year has a budget). */
  scoredNights: number;
  /** Koha banked on the scored nights - what `target` is compared with. */
  scoredActual: number;
  /** Sum of the nightly targets of the scored nights. */
  target: number;
  /** scoredActual − target (negative = behind). */
  variance: number;
  ratio: number | null;
  status: BudgetStatus | null;
  avgActualPerNight: number | null;
  /** Average nightly target over the scored nights. */
  avgTargetPerNight: number | null;
  statusCounts: Record<BudgetStatus, number>;
}

type RangeTotals = Pick<
  RangeProgress,
  "nightsHeld" | "actual" | "scoredNights" | "scoredActual" | "target" | "statusCounts"
>;

function finishRange(t: RangeTotals): RangeProgress {
  return {
    ...t,
    variance: t.scoredActual - t.target,
    ratio: t.target > 0 ? t.scoredActual / t.target : null,
    status: t.target > 0 ? budgetStatus(t.scoredActual, t.target) : null,
    avgActualPerNight: t.nightsHeld > 0 ? t.actual / t.nightsHeld : null,
    avgTargetPerNight: t.scoredNights > 0 ? t.target / t.scoredNights : null,
  };
}

/**
 * Koha against target over any run of nights (a week, a month, a custom
 * range). Unlike the annual view there is no fixed total to aim for: the
 * target is the sum of each night's own nightly target, so a range that
 * crosses into a new financial year scores each night against its own year.
 */
export function computeRangeProgress(nights: RangeNight[]): RangeProgress {
  const t: RangeTotals = {
    nightsHeld: nights.length,
    actual: 0,
    scoredNights: 0,
    scoredActual: 0,
    target: 0,
    statusCounts: { green: 0, yellow: 0, red: 0 },
  };
  for (const night of nights) {
    t.actual += night.actual;
    if (night.target === null) continue;
    t.scoredNights += 1;
    t.scoredActual += night.actual;
    t.target += night.target;
    t.statusCounts[budgetStatus(night.actual, night.target)]++;
  }
  return finishRange(t);
}

/** Adds up several locations' range progress into one network figure. */
export function sumRangeProgress(parts: RangeProgress[]): RangeProgress {
  const t: RangeTotals = {
    nightsHeld: 0,
    actual: 0,
    scoredNights: 0,
    scoredActual: 0,
    target: 0,
    statusCounts: { green: 0, yellow: 0, red: 0 },
  };
  for (const p of parts) {
    t.nightsHeld += p.nightsHeld;
    t.actual += p.actual;
    t.scoredNights += p.scoredNights;
    t.scoredActual += p.scoredActual;
    t.target += p.target;
    for (const s of ["green", "yellow", "red"] as const) {
      t.statusCounts[s] += p.statusCounts[s];
    }
  }
  return finishRange(t);
}

export interface NightlyTargetLocation {
  targetPerNight: number | null;
  budgets: Array<BudgetInput & { year: number }>;
}

export interface NightlyTarget {
  amount: number;
  /** "budget" = the night's budget year; "venue" = the standing per-night target. */
  source: "budget" | "venue";
  /** Budget year the night falls in. */
  budgetYear: number;
}

/**
 * One location's koha target for one night. A night in a year that has a
 * budget uses the budget's nightly target; any other night falls back to the
 * location's standing per-night target. Null when neither gives a target.
 */
export function resolveNightlyTarget(
  location: NightlyTargetLocation,
  date: Date
): NightlyTarget | null {
  const budgetYear = budgetYearOf(date);
  const budget = location.budgets.find((b) => b.year === budgetYear);
  if (budget) {
    const amount = nightlyTargetFor(budget);
    return amount === null ? null : { amount, source: "budget", budgetYear };
  }
  return location.targetPerNight === null
    ? null
    : { amount: location.targetPerNight, source: "venue", budgetYear };
}

/** Builds a (location, night) → koha target lookup over many locations. */
export function makeNightlyTargetLookup(
  locations: Array<NightlyTargetLocation & { name: string }>
): (location: string, date: Date) => number | null {
  const byName = new Map(locations.map((loc) => [loc.name, loc]));
  return (location, date) => {
    const loc = byName.get(location);
    return loc ? (resolveNightlyTarget(loc, date)?.amount ?? null) : null;
  };
}
