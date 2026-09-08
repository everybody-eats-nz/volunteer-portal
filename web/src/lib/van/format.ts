import { formatInNZT } from "@/lib/timezone";

/**
 * NZ-shaped formatting for the van log. Built on the app's existing
 * `formatInNZT` rather than raw `Intl`, so every date in the portal goes
 * through one timezone implementation.
 */

const nf = new Intl.NumberFormat("en-NZ");

export const formatOdo = (km: number) => nf.format(Math.round(km));
export const formatKm = (km: number) => `${nf.format(Math.round(km))} km`;

/** "6:12am" — lower case, no space, the way a NZ phone shows it. */
export const formatTime = (date: Date) =>
  formatInNZT(date, "h:mma").toLowerCase();

/** "3 Sep 2026" */
export const formatDate = (date: Date) => formatInNZT(date, "d MMM yyyy");

/** "Wed 3 Sep" */
export const formatDay = (date: Date) => formatInNZT(date, "EEE d MMM");

export const formatDateTime = (date: Date) =>
  `${formatDay(date)}, ${formatTime(date)}`;

/** ISO date key in NZ time, for grouping by day. */
export const dayKey = (date: Date) => formatInNZT(date, "yyyy-MM-dd");

export function formatDuration(from: Date, to: Date): string {
  const mins = Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  // "512 km in 0m" reads as a bug rather than as a warning about the reading.
  if (mins === 0) return "under a minute";
  if (h === 0) return `${m}m`;
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${m}m`;
}

/** "since 6:12am" today, "since Wed 3 Sep, 2:40pm" if it was another day. */
export const formatSince = (date: Date, now: Date) =>
  dayKey(date) === dayKey(now)
    ? `since ${formatTime(date)}`
    : `since ${formatDay(date)}, ${formatTime(date)}`;

/** First name only. Drivers are addressed by first name throughout. */
export const firstNameOf = (name: string | null | undefined) =>
  (name ?? "").trim().split(/\s+/)[0] || "Someone";
