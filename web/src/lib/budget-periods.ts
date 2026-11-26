import { TZDate } from "@date-fns/tz";
import { budgetYearLabel, budgetYearSpan } from "@/lib/budget-calculations";

/**
 * The window the budget tracking page looks at: a whole financial year (the
 * default), one calendar month, one Sunday-Saturday week or a custom run of
 * dates. Every date here is an NZ calendar day as `yyyy-MM-dd`, so all the
 * maths is plain calendar arithmetic with no timezone involved; only
 * `budgetPeriodBounds` turns a period into instants for the database.
 */

export type BudgetPeriodKind = "year" | "month" | "week" | "custom";

export const BUDGET_PERIOD_KINDS: BudgetPeriodKind[] = [
  "year",
  "month",
  "week",
  "custom",
];

export interface BudgetPeriodParams {
  period?: string;
  year?: string;
  /** Any day in the week or month to show. */
  date?: string;
  from?: string;
  to?: string;
}

export interface BudgetPeriod {
  kind: BudgetPeriodKind;
  /** First day, inclusive. */
  start: string;
  /** Last day, inclusive. */
  end: string;
  /**
   * The financial year in view: the picked year, or for any other period the
   * year its last day falls in. Budgets are set and edited for this year.
   */
  year: number;
  /** "2026/27", "November 2026", "22 – 28 Nov 2026" */
  label: string;
  /** The dates covered, written out: "1 Apr 2026 – 31 Mar 2027". */
  span: string;
  timing: "past" | "current" | "future";
  /** A day in the previous / next week or month; null for year and custom. */
  prev: string | null;
  next: string | null;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
/**
 * Longest custom range: three years (one leap day included). Keeps a stray
 * or bookmarked URL from loading decades of nights; longer asks are clamped
 * to the three years ending on their last day.
 */
export const MAX_CUSTOM_RANGE_DAYS = 3 * 365 + 1;

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
const NZ_TZ = "Pacific/Auckland";

interface Ymd {
  y: number;
  /** 1-12 */
  m: number;
  d: number;
}

function parseDay(value: string | undefined): Ymd | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [y, m, d] = match.slice(1).map(Number);
  if (y < MIN_YEAR || y > MAX_YEAR) return null;
  // Round-trip through a UTC date to reject 2026-02-30 and friends.
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return { y, m, d };
}

function toUtc({ y, m, d }: Ymd): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(date: Date): Ymd {
  return {
    y: date.getUTCFullYear(),
    m: date.getUTCMonth() + 1,
    d: date.getUTCDate(),
  };
}

function iso({ y, m, d }: Ymd): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function addDays(day: Ymd, days: number): Ymd {
  const date = toUtc(day);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUtc(date);
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** The financial year a day falls in (numbered by the March it ends in). */
function budgetYearOfDay({ y, m }: Ymd): number {
  return m >= 4 ? y + 1 : y;
}

/**
 * Budget weeks run Sunday to Saturday, as the team asked for this page.
 * 0 = Sunday, the same numbering as `Date.getDay` and react-day-picker's
 * `weekStartsOn`, so the calendars use this too.
 */
export const BUDGET_WEEK_STARTS_ON = 0;

/**
 * The first day of the budget week (a Sunday) on or before a day. Throws on
 * anything but a valid yyyy-MM-dd.
 */
export function weekStartOf(day: string): string {
  const parsed = parseDay(day);
  if (!parsed) throw new Error(`Invalid day: ${day}`);
  const weekday = toUtc(parsed).getUTCDay();
  return iso(addDays(parsed, -((weekday - BUDGET_WEEK_STARTS_ON + 7) % 7)));
}

/** "22 – 28 Nov 2026", "29 Nov – 5 Dec 2026", "28 Dec 2025 – 3 Jan 2026" */
export function formatDayRange(start: string, end: string): string {
  const a = parseDay(start);
  const b = parseDay(end);
  if (!a || !b) return `${start} – ${end}`;
  const mon = (m: number) => MONTHS[m - 1].slice(0, 3);
  if (start === end) return `${b.d} ${mon(b.m)} ${b.y}`;
  if (a.y !== b.y) return `${a.d} ${mon(a.m)} ${a.y} – ${b.d} ${mon(b.m)} ${b.y}`;
  if (a.m !== b.m) return `${a.d} ${mon(a.m)} – ${b.d} ${mon(b.m)} ${b.y}`;
  return `${a.d} – ${b.d} ${mon(b.m)} ${b.y}`;
}

function timingOf(
  start: string,
  end: string,
  today: string
): BudgetPeriod["timing"] {
  if (end < today) return "past";
  if (start > today) return "future";
  return "current";
}

function yearPeriod(year: number, today: string): BudgetPeriod {
  const start = `${year - 1}-04-01`;
  const end = `${year}-03-31`;
  return {
    kind: "year",
    start,
    end,
    year,
    label: budgetYearLabel(year),
    span: budgetYearSpan(year),
    timing: timingOf(start, end, today),
    prev: null,
    next: null,
  };
}

function monthPeriod(anchor: Ymd, today: string): BudgetPeriod {
  const first: Ymd = { y: anchor.y, m: anchor.m, d: 1 };
  const last: Ymd = { ...first, d: daysInMonth(anchor.y, anchor.m) };
  const start = iso(first);
  const end = iso(last);
  return {
    kind: "month",
    start,
    end,
    year: budgetYearOfDay(last),
    label: `${MONTHS[anchor.m - 1]} ${anchor.y}`,
    span: formatDayRange(start, end),
    timing: timingOf(start, end, today),
    prev: iso(addDays(first, -1)),
    next: iso(addDays(last, 1)),
  };
}

function weekPeriod(anchor: Ymd, today: string): BudgetPeriod {
  const start = weekStartOf(iso(anchor));
  const sunday = parseDay(start)!;
  const saturday = addDays(sunday, 6);
  const end = iso(saturday);
  const span = formatDayRange(start, end);
  return {
    kind: "week",
    start,
    end,
    year: budgetYearOfDay(saturday),
    label: span,
    span,
    timing: timingOf(start, end, today),
    prev: iso(addDays(sunday, -7)),
    next: iso(addDays(sunday, 7)),
  };
}

function customPeriod(from: Ymd, to: Ymd, today: string): BudgetPeriod {
  let start = iso(from);
  let end = iso(to);
  if (start > end) [start, end] = [end, start];
  const earliest = iso(addDays(parseDay(end)!, -(MAX_CUSTOM_RANGE_DAYS - 1)));
  if (start < earliest) start = earliest;
  const span = formatDayRange(start, end);
  return {
    kind: "custom",
    start,
    end,
    year: budgetYearOfDay(parseDay(end)!),
    label: span,
    span,
    timing: timingOf(start, end, today),
    prev: null,
    next: null,
  };
}

/**
 * Reads the page's search params into a period. Anything missing or invalid
 * falls back sensibly: no anchor date means the week or month containing
 * today, and a custom range without both ends means the current year.
 */
export function resolveBudgetPeriod(
  params: BudgetPeriodParams,
  today: string
): BudgetPeriod {
  const todayDay = parseDay(today);
  if (!todayDay) throw new Error(`Invalid today: ${today}`);
  const anchor = parseDay(params.date) ?? todayDay;

  switch (params.period) {
    case "month":
      return monthPeriod(anchor, today);
    case "week":
      return weekPeriod(anchor, today);
    case "custom": {
      const from = parseDay(params.from);
      const to = parseDay(params.to);
      if (from && to) return customPeriod(from, to, today);
      break;
    }
  }

  const requestedYear = Number(params.year);
  const year =
    Number.isInteger(requestedYear) &&
    requestedYear >= MIN_YEAR &&
    requestedYear <= MAX_YEAR
      ? requestedYear
      : budgetYearOfDay(todayDay);
  return yearPeriod(year, today);
}

/** Search params that reopen a period (without the location). */
export function budgetPeriodSearchParams(
  period: Pick<BudgetPeriod, "kind" | "year" | "start" | "end">
): Record<string, string> {
  switch (period.kind) {
    case "year":
      return { year: String(period.year) };
    case "month":
    case "week":
      return { period: period.kind, date: period.start };
    case "custom":
      return { period: "custom", from: period.start, to: period.end };
  }
}

/**
 * The period to open when the admin switches to another kind, kept close to
 * what they were looking at: today's week or month while that is inside the
 * current view, otherwise the last week or month of it. A custom range starts
 * as the current view's dates.
 */
export function switchBudgetPeriod(
  current: BudgetPeriod,
  kind: BudgetPeriodKind,
  today: string
): BudgetPeriod {
  if (kind === current.kind) return current;
  const anchor =
    today >= current.start && today <= current.end ? today : current.end;
  switch (kind) {
    case "year":
      return yearPeriod(current.year, today);
    case "month":
    case "week":
      return resolveBudgetPeriod({ period: kind, date: anchor }, today);
    case "custom":
      return resolveBudgetPeriod(
        { period: "custom", from: current.start, to: current.end },
        today
      );
  }
}

/** First instant of the first day and first instant after the last day (NZ). */
export function budgetPeriodBounds(period: Pick<BudgetPeriod, "start" | "end">): {
  start: Date;
  end: Date;
} {
  const a = parseDay(period.start)!;
  const b = addDays(parseDay(period.end)!, 1);
  return {
    start: new Date(new TZDate(a.y, a.m - 1, a.d, NZ_TZ).getTime()),
    end: new Date(new TZDate(b.y, b.m - 1, b.d, NZ_TZ).getTime()),
  };
}

/** Every day from start to end inclusive, as yyyy-MM-dd. */
export function eachDayOfPeriod(
  period: Pick<BudgetPeriod, "start" | "end">
): string[] {
  const days: string[] = [];
  let day = parseDay(period.start);
  const last = parseDay(period.end);
  if (!day || !last) return days;
  const end = iso(last);
  for (let d = iso(day); d <= end; d = iso(day)) {
    days.push(d);
    day = addDays(day, 1);
  }
  return days;
}

/** Financial years a period touches, oldest first. */
export function budgetYearsInPeriod(
  period: Pick<BudgetPeriod, "start" | "end">
): number[] {
  const first = budgetYearOfDay(parseDay(period.start)!);
  const last = budgetYearOfDay(parseDay(period.end)!);
  const years: number[] = [];
  for (let y = first; y <= last; y++) years.push(y);
  return years;
}
