/**
 * The reporting period, and the arithmetic behind it.
 *
 * Everybody Eats owes Meridian a monthly breakdown of how the vans are used, so
 * a month — not "the last 1500 trips" — is the unit the office actually works
 * in. This module is the month arithmetic for the admin trips ledger.
 *
 * Everything here operates on `dayKey` strings (`yyyy-MM-dd`, already in NZ time
 * from `format.ts`). Doing the maths on the key rather than on a `Date` means a
 * period can never drift across a timezone boundary or a daylight saving
 * change: "September" is the set of keys starting `2026-09`, on any device.
 */

export type Period =
  | { mode: "month"; month: string }
  | { mode: "range"; from: string; to: string }
  | { mode: "all" };

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-09-03" → "2026-09" */
export const monthOf = (dayKey: string) => dayKey.slice(0, 7);

/** "2026-09" → "September 2026" */
export function monthLabel(month: string): string {
  const [year, index] = month.split("-");
  const name = MONTH_NAMES[Number(index) - 1];
  return name ? `${name} ${year}` : month;
}

/** "2026-09" plus or minus whole months, staying a valid key. */
export function shiftMonth(month: string, delta: number): string {
  const [year, index] = month.split("-").map(Number);
  // Zero-based month arithmetic, so December + 1 rolls the year on its own.
  const total = year * 12 + (index - 1) + delta;
  const nextYear = Math.floor(total / 12);
  const nextMonth = total - nextYear * 12 + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

/** Does a trip's day fall inside the period? An empty range bound is open. */
export function inPeriod(dayKey: string, period: Period): boolean {
  if (period.mode === "all") return true;
  if (period.mode === "month") return monthOf(dayKey) === period.month;
  if (period.from && dayKey < period.from) return false;
  if (period.to && dayKey > period.to) return false;
  return true;
}

/** What the period is called on screen, and in the export filename. */
export function periodLabel(period: Period): string {
  if (period.mode === "month") return monthLabel(period.month);
  if (period.mode === "all") return "All time";
  if (period.from && period.to) return `${period.from} to ${period.to}`;
  if (period.from) return `From ${period.from}`;
  if (period.to) return `Up to ${period.to}`;
  return "Any date";
}

/** A filename-safe stem: "september-2026", "2026-03-01-to-2026-03-31". */
export function periodSlug(period: Period): string {
  return periodLabel(period)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * The months the record actually covers, newest first, with no holes.
 *
 * Gaps are filled in rather than skipped: a month in which nobody logged a trip
 * is a real answer to "what did we send Meridian in July", and a month picker
 * that jumps over it hides that.
 */
export function monthsCovered(dayKeys: string[]): string[] {
  if (dayKeys.length === 0) return [];
  const months = dayKeys.map(monthOf);
  let oldest = months[0];
  let newest = months[0];
  for (const month of months) {
    if (month < oldest) oldest = month;
    if (month > newest) newest = month;
  }
  const out: string[] = [];
  for (let m = newest; m >= oldest; m = shiftMonth(m, -1)) out.push(m);
  return out;
}
