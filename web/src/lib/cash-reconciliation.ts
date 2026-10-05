import { format } from "date-fns";

/**
 * Cash reconciliation: one location's cash koha, night by night, over a date
 * range, so a bank deposit can be checked against it.
 *
 * All dates here are NZ calendar days as "yyyy-MM-dd" strings. Calendar maths
 * is done on UTC-midnight Dates so DST never shifts a day.
 */

export const CASH_RANGE_PRESETS = [
  { value: "this-week", label: "Since Monday" },
  { value: "last-week", label: "Last week" },
  { value: "14d", label: "Last 14 days" },
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
] as const;

export type CashRangePreset = (typeof CASH_RANGE_PRESETS)[number]["value"];

// Cash is banked weekly or fortnightly, so two weeks covers either cadence.
export const DEFAULT_CASH_RANGE: CashRangePreset = "14d";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fromKey(key: string): Date {
  return new Date(`${key}T00:00:00Z`);
}

export function isDateKey(value: string | undefined | null): value is string {
  return !!value && DATE_RE.test(value) && toKey(fromKey(value)) === value;
}

export function addDaysToKey(key: string, days: number): string {
  const d = fromKey(key);
  d.setUTCDate(d.getUTCDate() + days);
  return toKey(d);
}

/** Inclusive from/to for a preset, relative to `today` (an NZ date key). */
export function resolveCashRange(
  preset: CashRangePreset,
  today: string
): { from: string; to: string } {
  const d = fromKey(today);
  // Monday-based week: getUTCDay() is 0 for Sunday.
  const sinceMonday = (d.getUTCDay() + 6) % 7;
  const monday = addDaysToKey(today, -sinceMonday);

  switch (preset) {
    case "this-week":
      return { from: monday, to: today };
    case "last-week":
      return { from: addDaysToKey(monday, -7), to: addDaysToKey(monday, -1) };
    case "14d":
      return { from: addDaysToKey(today, -13), to: today };
    case "this-month":
      return { from: `${today.slice(0, 7)}-01`, to: today };
    case "last-month": {
      const firstOfThisMonth = `${today.slice(0, 7)}-01`;
      const lastOfLastMonth = addDaysToKey(firstOfThisMonth, -1);
      return { from: `${lastOfLastMonth.slice(0, 7)}-01`, to: lastOfLastMonth };
    }
  }
}

/**
 * Read the range from URL params. A valid custom from/to wins; otherwise a
 * known preset; otherwise the default preset.
 */
export function parseCashRangeParams(
  params: { range?: string; from?: string; to?: string },
  today: string
): { range: CashRangePreset | "custom"; from: string; to: string } {
  const { range, from, to } = params;
  if (isDateKey(from) && isDateKey(to) && from <= to) {
    return { range: "custom", from, to };
  }
  const preset =
    CASH_RANGE_PRESETS.find((p) => p.value === range)?.value ??
    DEFAULT_CASH_RANGE;
  return { range: preset, ...resolveCashRange(preset, today) };
}

/**
 * - `recorded`: the night has a cash figure (including an explicit $0).
 * - `no-cash`: the night was recorded, but the cash field was left blank.
 * - `no-record`: shifts ran at the location, but nothing was recorded.
 */
export type CashNightStatus = "recorded" | "no-cash" | "no-record";
export type CashFlag = Exclude<CashNightStatus, "recorded">;

export const CASH_FLAG_LABEL: Record<CashFlag, string> = {
  "no-cash": "No cash recorded",
  "no-record": "Night not recorded",
};

export interface CashNight {
  date: string;
  cash: number | null;
  eftpos: number | null;
  stripe: number | null;
  status: CashNightStatus;
}

export interface CashTotals {
  cash: number;
  eftpos: number;
  stripe: number;
  nights: number;
  flagged: number;
}

export interface CashReconciliation {
  location: string;
  from: string;
  to: string;
  nights: CashNight[];
  totals: CashTotals;
}

export interface CashRecordInput {
  date: string;
  cash: number | null;
  eftpos: number | null;
  stripe: number | null;
}

// Sum in whole cents so a column of $x.10s never totals $x.0999999.
function sumCents(values: Array<number | null>): number {
  const cents = values.reduce<number>(
    (acc, v) => acc + (v === null ? 0 : Math.round(v * 100)),
    0
  );
  return cents / 100;
}

/**
 * Merge recorded nights with the days shifts ran, oldest first. A night with
 * shifts but no record is still listed, so a missing entry is never mistaken
 * for $0.
 */
export function buildCashNights(
  records: CashRecordInput[],
  shiftDates: string[]
): { nights: CashNight[]; totals: CashTotals } {
  const byDate = new Map<string, CashNight>();

  for (const r of records) {
    byDate.set(r.date, {
      date: r.date,
      cash: r.cash,
      eftpos: r.eftpos,
      stripe: r.stripe,
      status: r.cash === null ? "no-cash" : "recorded",
    });
  }
  for (const date of shiftDates) {
    if (!byDate.has(date)) {
      byDate.set(date, {
        date,
        cash: null,
        eftpos: null,
        stripe: null,
        status: "no-record",
      });
    }
  }

  const nights = [...byDate.values()].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  return {
    nights,
    totals: {
      cash: sumCents(nights.map((n) => n.cash)),
      eftpos: sumCents(nights.map((n) => n.eftpos)),
      stripe: sumCents(nights.map((n) => n.stripe)),
      nights: nights.length,
      flagged: nights.filter((n) => n.status !== "recorded").length,
    },
  };
}

const NZD = new Intl.NumberFormat("en-NZ", {
  style: "currency",
  currency: "NZD",
});

export const formatMoney = (n: number) => NZD.format(n);

// A local Date on the key's calendar day, only for formatting its parts.
export const keyToLocalDate = (key: string) => new Date(`${key}T00:00:00`);

export const formatNight = (key: string) =>
  format(keyToLocalDate(key), "EEE d MMM yyyy");

export function formatCashRange(from: string, to: string): string {
  if (from === to) return formatNight(from);
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  const start = format(
    keyToLocalDate(from),
    sameYear ? "EEE d MMM" : "EEE d MMM yyyy"
  );
  return `${start} – ${formatNight(to)}`;
}

/**
 * Plain text for the clipboard: one tab-separated line per night, so it
 * reads cleanly in a Xero note and splits into columns in a spreadsheet.
 */
export function buildCashCopyText(data: CashReconciliation): string {
  const lines = [
    `Cash reconciliation - ${data.location}`,
    formatCashRange(data.from, data.to),
    "",
    ...data.nights.map(
      (n) =>
        `${formatNight(n.date)}\t${
          n.status === "recorded" && n.cash !== null
            ? formatMoney(n.cash)
            : CASH_FLAG_LABEL[n.status as CashFlag]
        }`
    ),
    "",
    `Total cash\t${formatMoney(data.totals.cash)}`,
    `Service nights\t${data.totals.nights}`,
  ];
  if (data.totals.flagged > 0) {
    lines.push(`Nights with no cash recorded\t${data.totals.flagged}`);
  }
  return lines.join("\n");
}
