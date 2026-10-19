/**
 * Day report types: what a day at a location was, and how its takings are
 * recorded.
 *
 * - Service night: the restaurant's koha model (cash / EFTPOS / Stripe koha).
 *   The only type that counts as koha, so the only one in koha totals,
 *   budget tracking and restaurant analytics.
 * - Event: a fundraiser. Takings are itemised lines, each with a source, a
 *   category and a GST flag, totalled incl. and excl. GST.
 * - Cafe: a cafe day. Opening hours, customers, cash and EFTPOS sales.
 *
 * People served (MealsServed.mealsServed) counts towards impact for every type.
 *
 * Shared by the API, the report form and the Events & Cafe analytics page, so
 * it must stay free of server-only imports.
 */

export const DAY_REPORT_TYPES = ["SERVICE_NIGHT", "EVENT", "CAFE"] as const;
export type DayReportType = (typeof DAY_REPORT_TYPES)[number];

export const DAY_REPORT_TYPE_META: Record<
  DayReportType,
  { label: string; reportTitle: string }
> = {
  SERVICE_NIGHT: { label: "Service night", reportTitle: "Service Night Report" },
  EVENT: { label: "Event", reportTitle: "Event Report" },
  CAFE: { label: "Cafe", reportTitle: "Cafe Report" },
};

export function isDayReportType(value: unknown): value is DayReportType {
  return (
    typeof value === "string" &&
    (DAY_REPORT_TYPES as readonly string[]).includes(value)
  );
}

/** Prisma `where` fragment: only the days whose takings are koha. */
export const SERVICE_NIGHTS_ONLY = { reportType: "SERVICE_NIGHT" } as const;

// ── Event income ────────────────────────────────────────────────────────────

export const EVENT_INCOME_SOURCES = [
  "CASH",
  "EFTPOS",
  "STRIPE",
  "INVOICE",
] as const;
export type EventIncomeSource = (typeof EVENT_INCOME_SOURCES)[number];

export const EVENT_INCOME_SOURCE_LABEL: Record<EventIncomeSource, string> = {
  CASH: "Cash",
  EFTPOS: "EFTPOS",
  STRIPE: "Stripe",
  INVOICE: "Invoice",
};

export const EVENT_INCOME_CATEGORIES = [
  "KOHA",
  "SALES",
  "AUCTION",
  "DONATION",
  "OTHER",
] as const;
export type EventIncomeCategory = (typeof EVENT_INCOME_CATEGORIES)[number];

export const EVENT_INCOME_CATEGORY_LABEL: Record<EventIncomeCategory, string> =
  {
    KOHA: "Koha",
    SALES: "Sales",
    AUCTION: "Auction",
    DONATION: "Donation",
    OTHER: "Other",
  };

export const EVENT_INCOME_CATEGORY_HINT: Record<EventIncomeCategory, string> = {
  KOHA: "Pay-what-you-can on the night",
  SALES: "Tickets, merch, drinks",
  AUCTION: "Live or silent auction",
  DONATION: "Gifts and sponsorship",
  OTHER: "Anything else",
};

/** New Zealand GST. Taxable amounts are entered GST-inclusive. */
export const GST_RATE = 0.15;

export interface EventIncomeLine {
  source: EventIncomeSource;
  category: EventIncomeCategory;
  amount: number;
  gstIncluded: boolean;
}

export interface EventIncomeSummary {
  /** Everything taken, as entered (GST-inclusive). */
  total: number;
  /** GST contained in the taxable lines. */
  gst: number;
  /** Total less GST. */
  totalExGst: number;
  byCategory: Record<EventIncomeCategory, number>;
  bySource: Record<EventIncomeSource, number>;
}

const cents = (n: number) => Math.round(n * 100) / 100;

/** The GST contained in a GST-inclusive amount (3/23 of it at 15%). */
export function gstPortion(amount: number): number {
  return cents((amount * GST_RATE) / (1 + GST_RATE));
}

function zeroed<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
}

export function summariseEventIncome(
  lines: readonly EventIncomeLine[]
): EventIncomeSummary {
  const byCategory = zeroed(EVENT_INCOME_CATEGORIES);
  const bySource = zeroed(EVENT_INCOME_SOURCES);
  let total = 0;
  let gst = 0;
  for (const line of lines) {
    total += line.amount;
    // GST is worked out per line, as it would be on each receipt.
    if (line.gstIncluded) gst += gstPortion(line.amount);
    byCategory[line.category] += line.amount;
    bySource[line.source] += line.amount;
  }
  for (const k of EVENT_INCOME_CATEGORIES) byCategory[k] = cents(byCategory[k]);
  for (const k of EVENT_INCOME_SOURCES) bySource[k] = cents(bySource[k]);
  total = cents(total);
  gst = cents(gst);
  return { total, gst, totalExGst: cents(total - gst), byCategory, bySource };
}

// ── Cafe opening hours ──────────────────────────────────────────────────────

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isTimeOfDay(value: unknown): value is string {
  return typeof value === "string" && TIME_RE.test(value);
}

/** Minutes open, or null unless both times are set and close is after open. */
export function openMinutes(
  opensAt: string | null | undefined,
  closesAt: string | null | undefined
): number | null {
  if (!isTimeOfDay(opensAt) || !isTimeOfDay(closesAt)) return null;
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const diff = toMin(closesAt) - toMin(opensAt);
  return diff > 0 ? diff : null;
}

/** "6h 30m", "7h", "45m". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** "07:30" → "7:30am", "13:00" → "1pm". */
export function formatTimeOfDay(time: string): string {
  if (!isTimeOfDay(time)) return time;
  const h = Number(time.slice(0, 2));
  const m = time.slice(3);
  const suffix = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === "00" ? `${h12}${suffix}` : `${h12}:${m}${suffix}`;
}

// ── Which fields belong to which report ─────────────────────────────────────

/**
 * The stat columns each report type owns. On save, columns owned only by
 * another type are cleared, so a day switched from a service night to an
 * event can never leave stale koha behind. `mealsServed` and `notes` are
 * shared by every type.
 */
export const REPORT_FIELDS: Record<DayReportType, readonly string[]> = {
  SERVICE_NIGHT: [
    "weather",
    "bookingsPax",
    "nonPayingCount",
    "vege",
    "takeaways",
    "eftposTransactions",
    "cash",
    "eftpos",
    "stripe",
    "suggestedValue",
    "protein",
  ],
  EVENT: ["eventName"],
  CAFE: ["opensAt", "closesAt", "cash", "eftpos"],
};

export const ALL_REPORT_FIELDS = Array.from(
  new Set(Object.values(REPORT_FIELDS).flat())
);
