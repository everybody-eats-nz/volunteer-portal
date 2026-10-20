/**
 * The Events & Cafe report: fundraiser income and cafe takings over a
 * period. Pure aggregation over already-fetched day reports, shared by the
 * page and its tests. Neither is koha, so none of this touches koha totals.
 */

import {
  EVENT_INCOME_CATEGORIES,
  EVENT_INCOME_SOURCES,
  openMinutes,
  summariseEventIncome,
  type EventIncomeCategory,
  type EventIncomeLine,
  type EventIncomeSource,
} from "@/lib/day-reports";

export interface EventDayInput {
  date: string; // NZ day, "yyyy-MM-dd"
  location: string;
  eventName: string | null;
  pax: number | null;
  income: EventIncomeLine[];
}

export interface CafeDayInput {
  date: string; // NZ day, "yyyy-MM-dd"
  location: string;
  opensAt: string | null;
  closesAt: string | null;
  customers: number | null;
  cash: number | null;
  eftpos: number | null;
}

export interface EventRow {
  date: string;
  location: string;
  eventName: string | null;
  pax: number | null;
  total: number;
  totalExGst: number;
  lineCount: number;
}

export interface EventsReport {
  rows: EventRow[]; // newest first
  totals: {
    events: number;
    pax: number;
    total: number;
    gst: number;
    totalExGst: number;
    byCategory: Record<EventIncomeCategory, number>;
    bySource: Record<EventIncomeSource, number>;
  };
}

export interface CafeRow {
  date: string;
  location: string;
  opensAt: string | null;
  closesAt: string | null;
  minutesOpen: number | null;
  customers: number | null;
  cash: number | null;
  eftpos: number | null;
  total: number | null; // null when no takings were entered
}

export interface CafeReport {
  rows: CafeRow[]; // newest first
  totals: {
    days: number;
    customers: number;
    /** Opening hours added up, over the days that recorded both times. */
    minutesOpen: number;
    cash: number;
    eftpos: number;
    total: number;
    /** Average takings over the days that recorded any. */
    perDay: number | null;
    /** Takings ÷ customers, over the days that recorded both. */
    perCustomer: number | null;
  };
}

const cents = (n: number) => Math.round(n * 100) / 100;
const newestFirst = <T extends { date: string; location: string }>(
  a: T,
  b: T
) => b.date.localeCompare(a.date) || a.location.localeCompare(b.location);

export function buildEventsReport(days: EventDayInput[]): EventsReport {
  const all = summariseEventIncome(days.flatMap((d) => d.income));
  const rows = days
    .map((d) => {
      const s = summariseEventIncome(d.income);
      return {
        date: d.date,
        location: d.location,
        eventName: d.eventName,
        pax: d.pax,
        total: s.total,
        totalExGst: s.totalExGst,
        lineCount: d.income.length,
      };
    })
    .sort(newestFirst);

  return {
    rows,
    totals: {
      events: days.length,
      pax: days.reduce((sum, d) => sum + (d.pax ?? 0), 0),
      total: all.total,
      gst: all.gst,
      totalExGst: all.totalExGst,
      byCategory: all.byCategory,
      bySource: all.bySource,
    },
  };
}

export function buildCafeReport(days: CafeDayInput[]): CafeReport {
  let cash = 0;
  let eftpos = 0;
  let customers = 0;
  let minutesOpen = 0;
  let daysWithTakings = 0;
  let pairedTakings = 0;
  let pairedCustomers = 0;

  const rows = days
    .map((d) => {
      const hasTakings = d.cash !== null || d.eftpos !== null;
      const total = hasTakings ? cents((d.cash ?? 0) + (d.eftpos ?? 0)) : null;
      cash += d.cash ?? 0;
      eftpos += d.eftpos ?? 0;
      customers += d.customers ?? 0;
      const open = openMinutes(d.opensAt, d.closesAt);
      minutesOpen += open ?? 0;
      if (total !== null) {
        daysWithTakings += 1;
        if (d.customers) {
          pairedTakings += total;
          pairedCustomers += d.customers;
        }
      }
      return {
        date: d.date,
        location: d.location,
        opensAt: d.opensAt,
        closesAt: d.closesAt,
        minutesOpen: open,
        customers: d.customers,
        cash: d.cash,
        eftpos: d.eftpos,
        total,
      };
    })
    .sort(newestFirst);

  const total = cents(cash + eftpos);
  return {
    rows,
    totals: {
      days: days.length,
      customers,
      minutesOpen,
      cash: cents(cash),
      eftpos: cents(eftpos),
      total,
      perDay: daysWithTakings > 0 ? cents(total / daysWithTakings) : null,
      perCustomer:
        pairedCustomers > 0 ? cents(pairedTakings / pairedCustomers) : null,
    },
  };
}

/** Categories / sources with money against them, largest first. */
export function rankedShares<K extends string>(
  totals: Record<K, number>,
  keys: readonly K[]
): { key: K; amount: number; share: number }[] {
  const sum = keys.reduce((acc, k) => acc + totals[k], 0);
  return keys
    .filter((k) => totals[k] > 0)
    .map((k) => ({
      key: k,
      amount: totals[k],
      share: sum > 0 ? totals[k] / sum : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export const CATEGORY_KEYS = EVENT_INCOME_CATEGORIES;
export const SOURCE_KEYS = EVENT_INCOME_SOURCES;
