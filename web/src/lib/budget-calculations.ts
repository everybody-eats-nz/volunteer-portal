import { TZDate } from "@date-fns/tz";
import { toNZT } from "@/lib/timezone";

/**
 * Pure budget-tracking maths shared by the budget analytics page, the
 * restaurant analytics koha-vs-target figures and the locations admin.
 *
 * Budget years are NZ calendar years (1 Jan - 31 Dec, Pacific/Auckland).
 * `budgetYearRange` and `budgetYearOf` are the only places that encode that,
 * so moving to a financial year (e.g. 1 April) is a change to those two.
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

/** First instant of the budget year and first instant of the next one (NZ). */
export function budgetYearRange(year: number): { start: Date; end: Date } {
  return {
    start: new Date(new TZDate(year, 0, 1, NZ_TZ).getTime()),
    end: new Date(new TZDate(year + 1, 0, 1, NZ_TZ).getTime()),
  };
}

/** The budget year a service night (or any instant) belongs to. */
export function budgetYearOf(date: Date): number {
  return toNZT(date).getFullYear();
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

/**
 * Builds a (location, night) → koha target lookup. A night in a year that has
 * a budget uses the budget's nightly target; any other night falls back to the
 * location's standing per-night target.
 */
export function makeNightlyTargetLookup(
  locations: Array<{
    name: string;
    targetPerNight: number | null;
    budgets: Array<BudgetInput & { year: number }>;
  }>
): (location: string, date: Date) => number | null {
  const fallback = new Map<string, number | null>();
  const byYear = new Map<string, number | null>();
  for (const loc of locations) {
    fallback.set(loc.name, loc.targetPerNight);
    for (const budget of loc.budgets) {
      byYear.set(`${loc.name}|${budget.year}`, nightlyTargetFor(budget));
    }
  }
  return (location, date) => {
    const key = `${location}|${budgetYearOf(date)}`;
    if (byYear.has(key)) return byYear.get(key) ?? null;
    return fallback.get(location) ?? null;
  };
}
