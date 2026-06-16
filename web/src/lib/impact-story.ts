import { prisma } from "@/lib/prisma";
import { toNZT } from "@/lib/timezone";
import {
  FOOD_SAVED_KG_PER_MEAL,
  getPublicImpactStats,
} from "@/lib/impact-stats";

/**
 * Public "impact story" dataset consumed by the marketing site's `/impact`
 * page. Where {@link getPublicImpactStats} returns the three headline numbers,
 * this returns the richer, all-time aggregates the data-story is built from:
 * a year-by-year breakdown of koha and need, the payment mix, per-venue and
 * per-weeknight rhythms, and the volunteer milestone ladder.
 *
 * Everything here is aggregate and non-sensitive — no per-person rows leave the
 * portal. Definitions deliberately mirror the admin restaurant-analytics
 * dashboard (`src/lib/restaurant-analytics.ts`) so the public figures agree with
 * what staff see internally:
 *   - perHead   = koha ÷ customers, over nights that recorded koha
 *   - perPaying = koha ÷ (customers − non-paying), over nights that recorded koha
 *   - nonPaying% = non-paying customers ÷ all customers
 *
 * Backs a cacheable public endpoint, so it runs a single all-time `findMany`
 * over MealsServed plus two small grouped volunteer queries.
 */

export type ImpactStoryYear = {
  year: number;
  nights: number;
  customers: number;
  koha: number;
  perHead: number | null;
  perPaying: number | null;
  nonPayingPercent: number | null;
  /** Share of koha by tender, as percentages that sum to ~100 (0 when no koha). */
  cashPercent: number;
  eftposPercent: number;
  digitalPercent: number;
  /** True for the first and current calendar years, which don't span 12 months. */
  partial: boolean;
};

export type ImpactStoryLocation = {
  name: string;
  firstYear: number;
  nights: number;
  customers: number;
  koha: number;
  perHead: number | null;
  avgCustomersPerNight: number;
  weeknightPerHead: number | null;
  weekendPerHead: number | null;
};

export type ImpactStoryWeekday = {
  /** 0 = Sunday … 6 = Saturday (NZ time). */
  day: number;
  label: string;
  weekend: boolean;
  perHead: number | null;
  avgCustomersPerNight: number;
};

export type ImpactStoryMilestone = {
  /** Minimum completed-shift count for this rung (10, 25, 50, …). */
  threshold: number;
  /** Volunteers who have served at least `threshold` shifts. */
  volunteers: number;
};

export type PublicImpactStory = {
  totals: {
    nights: number;
    meals: number;
    koha: number;
    newVolunteers: number;
    volunteers: number;
    volunteerHours: number;
    foodSavedKg: number;
    foodSavedKgPerMeal: number;
    perHead: number | null;
    perPaying: number | null;
    nonPayingPercent: number | null;
    firstNight: string | null;
    lastNight: string | null;
  };
  yearly: ImpactStoryYear[];
  locations: ImpactStoryLocation[];
  weekday: ImpactStoryWeekday[];
  milestones: ImpactStoryMilestone[];
  generatedAt: string;
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MILESTONE_RUNGS = [10, 25, 50, 100, 200] as const;

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const pct = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;

/** Running tallies for one bucket (a year, a venue, or a weekday). */
type Bucket = {
  nights: number;
  customers: number;
  koha: number;
  cash: number;
  eftpos: number;
  stripe: number;
  customersWithKoha: number;
  nonPayingWithKoha: number;
  nonPayingCount: number;
};

const emptyBucket = (): Bucket => ({
  nights: 0,
  customers: 0,
  koha: 0,
  cash: 0,
  eftpos: 0,
  stripe: 0,
  customersWithKoha: 0,
  nonPayingWithKoha: 0,
  nonPayingCount: 0,
});

const perHead = (b: Bucket) =>
  b.customersWithKoha > 0 ? round2(b.koha / b.customersWithKoha) : null;
const perPaying = (b: Bucket) => {
  const paying = b.customersWithKoha - b.nonPayingWithKoha;
  return paying > 0 ? round2(b.koha / paying) : null;
};
const nonPayingPercent = (b: Bucket) =>
  b.customers > 0 ? Math.round((b.nonPayingCount / b.customers) * 100) : null;

export async function getPublicImpactStory(): Promise<PublicImpactStory> {
  const now = new Date();
  const currentYear = toNZT(now).getFullYear();

  const [rows, headline, milestoneRows, volunteerCountRows] = await Promise.all([
    prisma.mealsServed.findMany({
      where: { mealsServed: { not: null } },
      select: {
        date: true,
        location: true,
        mealsServed: true,
        nonPayingCount: true,
        newVolunteers: true,
        cash: true,
        eftpos: true,
        stripe: true,
      },
      orderBy: { date: "asc" },
    }),
    // Reuse the lean headline computation (people served, hours, food saved).
    getPublicImpactStats(),
    // Milestone ladder: how many volunteers have reached each completed-shift rung.
    prisma.$queryRaw<{ shifts: number }[]>`
      SELECT COUNT(*)::int AS shifts
      FROM "Signup" sg
      JOIN "Shift" s ON s.id = sg."shiftId"
      WHERE sg.status = 'CONFIRMED' AND s."end" < ${now}
      GROUP BY sg."userId"
    `,
    // Distinct volunteers with at least one completed, confirmed shift.
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT sg."userId")::bigint AS count
      FROM "Signup" sg
      JOIN "Shift" s ON s.id = sg."shiftId"
      WHERE sg.status = 'CONFIRMED' AND s."end" < ${now}
    `,
  ]);

  const byYear = new Map<number, Bucket>();
  const byLocation = new Map<string, Bucket & { firstYear: number }>();
  const byWeekday = new Map<number, Bucket>();
  // Per-location weeknight (Mon–Fri) vs weekend (Sat–Sun) koha intensity.
  const locWeeknight = new Map<string, Bucket>();
  const locWeekend = new Map<string, Bucket>();

  let newVolunteers = 0;

  const bump = (map: Map<number, Bucket> | Map<string, Bucket>, key: number | string) => {
    let b = (map as Map<number | string, Bucket>).get(key);
    if (!b) {
      b = emptyBucket();
      (map as Map<number | string, Bucket>).set(key, b);
    }
    return b;
  };

  const add = (b: Bucket, customers: number, cash: number, eftpos: number, stripe: number, nonPaying: number) => {
    const koha = cash + eftpos + stripe;
    b.nights += 1;
    b.customers += customers;
    b.cash += cash;
    b.eftpos += eftpos;
    b.stripe += stripe;
    b.koha += koha;
    if (koha > 0) {
      b.customersWithKoha += customers;
      b.nonPayingWithKoha += nonPaying;
    }
    b.nonPayingCount += nonPaying;
  };

  for (const r of rows) {
    const customers = r.mealsServed ?? 0;
    const cash = toNum(r.cash);
    const eftpos = toNum(r.eftpos);
    const stripe = toNum(r.stripe);
    const nonPaying = r.nonPayingCount ?? 0;
    newVolunteers += r.newVolunteers ?? 0;

    const year = Number(r.date.toISOString().slice(0, 4));
    const nzDay = toNZT(r.date).getDay();
    const isWeekend = nzDay === 0 || nzDay === 6;

    add(bump(byYear, year), customers, cash, eftpos, stripe, nonPaying);
    add(bump(byWeekday, nzDay), customers, cash, eftpos, stripe, nonPaying);

    let loc = byLocation.get(r.location);
    if (!loc) {
      loc = { ...emptyBucket(), firstYear: year };
      byLocation.set(r.location, loc);
    } else if (year < loc.firstYear) {
      loc.firstYear = year;
    }
    add(loc, customers, cash, eftpos, stripe, nonPaying);
    add(bump(isWeekend ? locWeekend : locWeeknight, r.location), customers, cash, eftpos, stripe, nonPaying);
  }

  const firstYear = Math.min(...byYear.keys());
  const yearly: ImpactStoryYear[] = [...byYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, b]) => ({
      year,
      nights: b.nights,
      customers: b.customers,
      koha: Math.round(b.koha),
      perHead: perHead(b),
      perPaying: perPaying(b),
      nonPayingPercent: nonPayingPercent(b),
      cashPercent: pct(b.cash, b.koha),
      eftposPercent: pct(b.eftpos, b.koha),
      digitalPercent: pct(b.stripe, b.koha),
      partial: year === currentYear || year === firstYear,
    }));

  const locations: ImpactStoryLocation[] = [...byLocation.entries()]
    .sort(([, a], [, b]) => b.customers - a.customers)
    .map(([name, b]) => ({
      name,
      firstYear: b.firstYear,
      nights: b.nights,
      customers: b.customers,
      koha: Math.round(b.koha),
      perHead: perHead(b),
      avgCustomersPerNight: b.nights > 0 ? Math.round(b.customers / b.nights) : 0,
      weeknightPerHead: perHead(locWeeknight.get(name) ?? emptyBucket()),
      weekendPerHead: perHead(locWeekend.get(name) ?? emptyBucket()),
    }));

  const weekday: ImpactStoryWeekday[] = [...byWeekday.entries()]
    .sort(([a], [b]) => a - b)
    .map(([day, b]) => ({
      day,
      label: WEEKDAY_LABELS[day],
      weekend: day === 0 || day === 6,
      perHead: perHead(b),
      avgCustomersPerNight: b.nights > 0 ? Math.round(b.customers / b.nights) : 0,
    }));

  // Milestone ladder — count volunteers at or above each rung.
  const shiftCounts = milestoneRows.map((m) => m.shifts);
  const milestones: ImpactStoryMilestone[] = MILESTONE_RUNGS.map((threshold) => ({
    threshold,
    volunteers: shiftCounts.filter((c) => c >= threshold).length,
  }));

  // Totals — fold every year's bucket into one for the all-time service figures.
  const allTime = [...byYear.values()].reduce<Bucket>((acc, b) => {
    acc.nights += b.nights;
    acc.customers += b.customers;
    acc.koha += b.koha;
    acc.cash += b.cash;
    acc.eftpos += b.eftpos;
    acc.stripe += b.stripe;
    acc.customersWithKoha += b.customersWithKoha;
    acc.nonPayingWithKoha += b.nonPayingWithKoha;
    acc.nonPayingCount += b.nonPayingCount;
    return acc;
  }, emptyBucket());

  return {
    totals: {
      nights: allTime.nights,
      meals: headline.peopleServed,
      koha: Math.round(allTime.koha),
      newVolunteers,
      volunteers: Number(volunteerCountRows[0]?.count ?? 0),
      volunteerHours: headline.volunteerHours,
      foodSavedKg: headline.foodSavedKg,
      foodSavedKgPerMeal: FOOD_SAVED_KG_PER_MEAL,
      perHead: perHead(allTime),
      perPaying: perPaying(allTime),
      nonPayingPercent: nonPayingPercent(allTime),
      firstNight: rows[0]?.date.toISOString().slice(0, 10) ?? null,
      lastNight: rows[rows.length - 1]?.date.toISOString().slice(0, 10) ?? null,
    },
    yearly,
    locations,
    weekday,
    milestones,
    generatedAt: now.toISOString(),
  };
}
