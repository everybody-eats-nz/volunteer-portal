import { prisma } from "@/lib/prisma";
import { nowInNZT, toNZT } from "@/lib/timezone";

/**
 * Reproduces the legacy Looker dashboard breakdowns from MealsServed records:
 * per-location summary, monthly/yearly trends, year & year-month tables,
 * paying-vs-non-paying, new-volunteers-by-location, $/head by weekday, and the
 * bookings-vs-donations scatter. One pass over the filtered records.
 */

interface MetricSeries {
  customers: number[];
  koha: number[];
  nights: number[];
  nonPaying: number[];
  paying: number[];
  bookings: number[];
  newVolunteers: number[];
  perHead: (number | null)[];
  avgCustomers: (number | null)[];
  avgKohaPerNight: (number | null)[];
}

export interface SummaryRow {
  location: string;
  nights: number;
  totalKoha: number;
  avgKohaPerNight: number | null;
  customers: number;
  perHead: number | null;
  aveNonPaying: number | null;
  aveCustomers: number | null;
}

export interface RestaurantReports {
  summary: { rows: SummaryRow[]; grand: SummaryRow };
  monthLabels: string[];
  yearLabels: string[];
  monthly: MetricSeries;
  yearly: MetricSeries;
  byYear: Array<{ year: string; location: string; koha: number; customers: number }>;
  byYearMonth: Array<{ ym: string; location: string; koha: number; customers: number }>;
  newVolByLocation: {
    series: Array<{ location: string; data: number[] }>;
    totals: Array<{ location: string; newVolunteers: number }>;
  };
  weekday: Array<{ day: string; perHead: number | null; koha: number; nights: number }>;
  scatter: Array<{ bookings: number; koha: number }>;
  hasData: boolean;
}

const toNum = (v: unknown): number => {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;
const div = (a: number, b: number): number | null => (b > 0 ? round2(a / b) : null);

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface Bucket {
  customers: number;
  koha: number;
  nights: number;
  nonPaying: number;
  bookings: number;
  newVolunteers: number;
}
const emptyBucket = (): Bucket => ({
  customers: 0,
  koha: 0,
  nights: 0,
  nonPaying: 0,
  bookings: 0,
  newVolunteers: 0,
});

function add(b: Bucket, r: { customers: number; koha: number; nonPaying: number; bookings: number; newVol: number }) {
  b.customers += r.customers;
  b.koha += r.koha;
  b.nights += 1;
  b.nonPaying += r.nonPaying;
  b.bookings += r.bookings;
  b.newVolunteers += r.newVol;
}

function seriesFromBuckets(buckets: Bucket[]): MetricSeries {
  return {
    customers: buckets.map((b) => b.customers),
    koha: buckets.map((b) => round2(b.koha)),
    nights: buckets.map((b) => b.nights),
    nonPaying: buckets.map((b) => Math.round(b.nonPaying)),
    paying: buckets.map((b) => Math.max(0, Math.round(b.customers - b.nonPaying))),
    bookings: buckets.map((b) => b.bookings),
    newVolunteers: buckets.map((b) => b.newVolunteers),
    perHead: buckets.map((b) => div(b.koha, b.customers)),
    avgCustomers: buckets.map((b) => div(b.customers, b.nights)),
    avgKohaPerNight: buckets.map((b) => div(b.koha, b.nights)),
  };
}

export async function getRestaurantReports(
  months: number,
  location: string | null,
  daysFilter: number[] | null = null,
  from: string | null = null,
  to: string | null = null
): Promise<RestaurantReports> {
  const isLocationFiltered = !!location && location !== "all";

  // Date window — custom range overrides the month preset (mirrors analytics)
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const customRange =
    from && to && dateRe.test(from) && dateRe.test(to) && from <= to;
  const nz = nowInNZT();
  const todayEnd = new Date(nz.getFullYear(), nz.getMonth(), nz.getDate(), 23, 59, 59, 999);
  let startDate: Date;
  let endDate: Date;
  if (customRange) {
    startDate = new Date(`${from}T00:00:00`);
    endDate = new Date(`${to}T23:59:59.999`);
  } else if (months <= 0) {
    // All time — span from the earliest recorded night to today
    const bounds = await prisma.mealsServed.aggregate({
      where: isLocationFiltered ? { location: location! } : {},
      _min: { date: true },
    });
    startDate = bounds._min.date ?? new Date(2017, 0, 1);
    endDate = todayEnd;
  } else {
    endDate = todayEnd;
    startDate = new Date(nz.getFullYear(), nz.getMonth() - months, nz.getDate());
  }

  const records = await prisma.mealsServed.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      ...(isLocationFiltered ? { location: location! } : {}),
    },
    select: {
      date: true,
      location: true,
      mealsServed: true,
      nonPayingCount: true,
      cash: true,
      eftpos: true,
      stripe: true,
      newVolunteers: true,
      bookingsPax: true,
    },
  });

  // Continuous month + year buckets across the window
  const monthLabels: string[] = [];
  {
    const c = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const e = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    while (c <= e) {
      monthLabels.push(`${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, "0")}`);
      c.setMonth(c.getMonth() + 1);
    }
  }
  const yearLabels: string[] = [];
  for (let y = startDate.getFullYear(); y <= endDate.getFullYear(); y++) {
    yearLabels.push(String(y));
  }
  const monthIdx = new Map(monthLabels.map((m, i) => [m, i]));
  const yearIdx = new Map(yearLabels.map((y, i) => [y, i]));

  const monthBuckets = monthLabels.map(emptyBucket);
  const yearBuckets = yearLabels.map(emptyBucket);
  const byLocation = new Map<string, Bucket>();
  const weekdayBuckets = WEEKDAYS.map(emptyBucket);
  const byYearLoc = new Map<string, { koha: number; customers: number }>();
  const byYmLoc = new Map<string, { koha: number; customers: number }>();
  const newVolLocMonth = new Map<string, number[]>(); // location -> per-month newVol
  const scatter: Array<{ bookings: number; koha: number }> = [];

  records.forEach((rec) => {
    if (daysFilter) {
      const nzDay = toNZT(rec.date).getDay();
      if (!daysFilter.includes(nzDay)) return;
    }
    const iso = rec.date.toISOString();
    const ym = iso.substring(0, 7);
    const year = iso.substring(0, 4);
    const weekday = toNZT(rec.date).getDay();
    const loc = rec.location;
    const customers = rec.mealsServed ?? 0;
    const koha = toNum(rec.cash) + toNum(rec.eftpos) + toNum(rec.stripe);
    const nonPaying = rec.nonPayingCount ?? 0;
    const bookings = rec.bookingsPax ?? 0;
    const newVol = rec.newVolunteers ?? 0;
    const row = { customers, koha, nonPaying, bookings, newVol };

    const mi = monthIdx.get(ym);
    if (mi !== undefined) add(monthBuckets[mi], row);
    const yi = yearIdx.get(year);
    if (yi !== undefined) add(yearBuckets[yi], row);

    if (!byLocation.has(loc)) byLocation.set(loc, emptyBucket());
    add(byLocation.get(loc)!, row);

    add(weekdayBuckets[weekday], row);

    const ylKey = `${year}|${loc}`;
    const yl = byYearLoc.get(ylKey) || { koha: 0, customers: 0 };
    yl.koha += koha;
    yl.customers += customers;
    byYearLoc.set(ylKey, yl);

    const ymKey = `${ym}|${loc}`;
    const yml = byYmLoc.get(ymKey) || { koha: 0, customers: 0 };
    yml.koha += koha;
    yml.customers += customers;
    byYmLoc.set(ymKey, yml);

    if (mi !== undefined) {
      if (!newVolLocMonth.has(loc)) newVolLocMonth.set(loc, monthLabels.map(() => 0));
      newVolLocMonth.get(loc)![mi] += newVol;
    }

    if (rec.bookingsPax !== null && rec.bookingsPax > 0 && koha > 0) {
      scatter.push({ bookings: rec.bookingsPax, koha: round2(koha) });
    }
  });

  // Summary rows (per location) + grand total
  const summaryRow = (loc: string, b: Bucket): SummaryRow => ({
    location: loc,
    nights: b.nights,
    totalKoha: round2(b.koha),
    avgKohaPerNight: div(b.koha, b.nights),
    customers: b.customers,
    perHead: div(b.koha, b.customers),
    aveNonPaying: div(b.nonPaying, b.nights),
    aveCustomers: div(b.customers, b.nights),
  });
  const rows = [...byLocation.entries()]
    .map(([loc, b]) => summaryRow(loc, b))
    .sort((a, b) => b.totalKoha - a.totalKoha);
  const grandBucket = emptyBucket();
  byLocation.forEach((b) => {
    grandBucket.customers += b.customers;
    grandBucket.koha += b.koha;
    grandBucket.nights += b.nights;
    grandBucket.nonPaying += b.nonPaying;
  });
  const grand = summaryRow("Grand total", grandBucket);

  const byYear = [...byYearLoc.entries()]
    .map(([k, v]) => {
      const [year, loc] = k.split("|");
      return { year, location: loc, koha: round2(v.koha), customers: v.customers };
    })
    .sort((a, b) => (a.year === b.year ? a.location.localeCompare(b.location) : b.year.localeCompare(a.year)));

  const byYearMonth = [...byYmLoc.entries()]
    .map(([k, v]) => {
      const [ym, loc] = k.split("|");
      return { ym, location: loc, koha: round2(v.koha), customers: v.customers };
    })
    .sort((a, b) => (a.ym === b.ym ? a.location.localeCompare(b.location) : b.ym.localeCompare(a.ym)));

  const newVolSeries = [...newVolLocMonth.entries()]
    .map(([loc, data]) => ({ location: loc, data }))
    .sort((a, b) => b.data.reduce((s, n) => s + n, 0) - a.data.reduce((s, n) => s + n, 0));
  const newVolTotals = newVolSeries
    .map((s) => ({ location: s.location, newVolunteers: s.data.reduce((a, n) => a + n, 0) }))
    .filter((t) => t.newVolunteers > 0);

  const weekday = WEEKDAYS.map((day, i) => ({
    day,
    perHead: div(weekdayBuckets[i].koha, weekdayBuckets[i].customers),
    koha: round2(weekdayBuckets[i].koha),
    nights: weekdayBuckets[i].nights,
  }));

  return {
    summary: { rows, grand },
    monthLabels,
    yearLabels,
    monthly: seriesFromBuckets(monthBuckets),
    yearly: seriesFromBuckets(yearBuckets),
    byYear,
    byYearMonth,
    newVolByLocation: { series: newVolSeries, totals: newVolTotals },
    weekday,
    scatter,
    hasData: records.length > 0,
  };
}
