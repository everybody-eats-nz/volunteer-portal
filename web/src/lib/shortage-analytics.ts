import { prisma } from "@/lib/prisma";
import { formatInNZT } from "@/lib/timezone";

/**
 * Analytics over `ShortageNotificationLog` — how many shift-shortage
 * notifications have gone out, org-wide and per restaurant.
 *
 * The log stores one row per recipient per send, so we distinguish two counts:
 *  - **Send events**: distinct notification batches an admin dispatched. A batch
 *    is identified by its `(sentAt, sentBy)` tuple — every recipient of one send
 *    shares those values.
 *  - **Emails**: individual notification emails, i.e. one per log row.
 *
 * A single send can cover shifts at more than one restaurant (the sites live
 * denormalized inside the `shifts` JSON). Such a send counts once org-wide but
 * toward *each* site it touched in the per-site breakdown.
 */

/** Fallback bucket for a shift whose location wasn't recorded on the log. */
export const UNKNOWN_SITE = "Unknown";

/** One shift entry inside a log's denormalized `shifts` JSON array. */
interface LoggedShift {
  shiftId?: string;
  shiftTypeName?: string;
  shiftDate?: string;
  shiftLocation?: string;
}

/** The subset of `ShortageNotificationLog` columns the analytics rely on. */
export interface ShortageLogRow {
  sentAt: Date;
  sentBy: string;
  recipientId: string;
  success: boolean;
  /** JSON payload: an array of {@link LoggedShift}. */
  shifts: unknown;
  /** Denormalized recipient name — only selected for the converters rollup. */
  recipientName?: string;
  /** Denormalized recipient email — only selected for the converters rollup. */
  recipientEmail?: string;
}

/** Notification figures for a single restaurant (or "Unknown"). */
export interface ShortageSiteRow {
  location: string;
  /** Distinct send events (batches) that covered a shift at this site. */
  sendEvents: number;
  /** Notification emails whose send covered a shift at this site. */
  emails: number;
  /** Of those emails, how many were delivered successfully. */
  successfulEmails: number;
  /** Of those emails, how many failed to send. */
  failedEmails: number;
  /** Distinct volunteers emailed about a shortage at this site. */
  volunteersReached: number;
  /** successfulEmails / emails as a 0–100 percentage. */
  successRate: number;
  /** Delivered alerts here whose recipient then signed up for a shift here. */
  converted: number;
  /** converted / successfulEmails as a 0–100 percentage. */
  conversionRate: number;
}

/** Org-wide notification figures for the period. */
export interface ShortageTotals {
  /** Distinct send events (batches) across the org. */
  sendEvents: number;
  /** Total notification emails sent. */
  emails: number;
  successfulEmails: number;
  failedEmails: number;
  /** Distinct volunteers emailed at least once. */
  volunteersReached: number;
  successRate: number;
  /** Delivered alerts whose recipient then signed up for a notified shift. */
  converted: number;
  /** converted / successfulEmails as a 0–100 percentage. */
  conversionRate: number;
}

/** A single month bucket for the trend chart. */
export interface ShortageTrendPoint {
  /** Sort key, e.g. "2026-01". */
  month: string;
  /** Display label, e.g. "Jan 2026". */
  label: string;
  sendEvents: number;
  emails: number;
  /** Successfully delivered emails that month. */
  deliveredEmails: number;
  /** Delivered alerts that led to a signup (conversions) that month. */
  signups: number;
}

/** Delivered alerts for one restaurant across the trend months. */
export interface ShortageTrendLocationSeries {
  location: string;
  /** Delivered alerts at this site per month, aligned to `trend[].month`. */
  delivered: number[];
}

export interface ShortageNotificationAnalytics {
  totals: ShortageTotals;
  bySite: ShortageSiteRow[];
  trend: ShortageTrendPoint[];
  /**
   * Delivered alerts per month split by restaurant, in the same month order as
   * `trend`, for the stacked "over time" chart. Location order matches `bySite`.
   */
  trendByLocation: ShortageTrendLocationSeries[];
  /** 0 means "all time" (no lower bound on the window). */
  periodMonths: number;
}

/** Rounded 0–100 percentage that never divides by zero. */
export function percentage(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/**
 * Parse a `months` query/search param into a trailing-window length. Returns
 * `0` for "all" (all time); any missing, invalid, or non-positive value falls
 * back to the 12-month default.
 */
export function parseMonthsParam(value: string | null | undefined): number {
  if (value === "all") return 0;
  const parsed = parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 12;
}

/** Stable identifier for the send batch a log row belongs to. */
function batchKey(row: ShortageLogRow): string {
  return `${row.sentAt.toISOString()}|${row.sentBy}`;
}

/**
 * Map each restaurant site a log row covered to the notified shift IDs at that
 * site, read from the denormalized `shifts` JSON. Blank or missing locations
 * fall back to {@link UNKNOWN_SITE}; a row with no shifts at all still
 * represents a send (a single Unknown bucket with no shift IDs).
 */
export function shiftsByLocationForLog(
  row: ShortageLogRow
): Map<string, string[]> {
  const shifts: LoggedShift[] = Array.isArray(row.shifts)
    ? (row.shifts as LoggedShift[])
    : [];
  const byLocation = new Map<string, string[]>();
  for (const shift of shifts) {
    const loc = (shift?.shiftLocation ?? "").trim() || UNKNOWN_SITE;
    const id = (shift?.shiftId ?? "").trim();
    const ids = byLocation.get(loc) ?? [];
    if (id) ids.push(id);
    byLocation.set(loc, ids);
  }
  if (byLocation.size === 0) byLocation.set(UNKNOWN_SITE, []);
  return byLocation;
}

/** Distinct restaurant sites a single log row covered. */
export function sitesForLog(row: ShortageLogRow): string[] {
  return [...shiftsByLocationForLog(row).keys()];
}

/**
 * When each volunteer signed up for each shift, keyed `${userId}|${shiftId}`.
 * Used to detect whether an alert led to a signup afterwards.
 */
export type SignupIndex = Map<string, Date>;

/** Key into a {@link SignupIndex}. */
export function signupKey(userId: string, shiftId: string): string {
  return `${userId}|${shiftId}`;
}

/**
 * How soon after a delivered alert a signup must land to be credited to it.
 * A signup weeks later almost certainly wasn't driven by the alert, so only
 * signups within this window count toward effectiveness.
 */
export const CONVERSION_WINDOW_DAYS = 3;
const CONVERSION_WINDOW_MS = CONVERSION_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/**
 * True if `signedUpAt` falls in the crediting window for an alert sent at
 * `sentAt`: strictly after the alert and no more than
 * {@link CONVERSION_WINDOW_DAYS} days later.
 */
function withinConversionWindow(sentAt: Date, signedUpAt: Date): boolean {
  const gap = signedUpAt.getTime() - sentAt.getTime();
  return gap > 0 && gap <= CONVERSION_WINDOW_MS;
}

/**
 * The earliest signup by `recipientId` for any of `shiftIds` that falls within
 * the crediting window after `sentAt`, or `null` if none qualifies. Signups
 * before the alert (already-committed volunteers) or more than
 * {@link CONVERSION_WINDOW_DAYS} days later don't count.
 */
function qualifyingSignupTime(
  recipientId: string,
  shiftIds: string[],
  sentAt: Date,
  signups: SignupIndex
): Date | null {
  let earliest: Date | null = null;
  for (const shiftId of shiftIds) {
    const signedUpAt = signups.get(signupKey(recipientId, shiftId));
    if (signedUpAt && withinConversionWindow(sentAt, signedUpAt)) {
      if (!earliest || signedUpAt.getTime() < earliest.getTime()) {
        earliest = signedUpAt;
      }
    }
  }
  return earliest;
}

/**
 * True if `recipientId` signed up for any of `shiftIds` within the crediting
 * window after `sentAt` — i.e. the alert plausibly drove the signup.
 */
function convertedForShifts(
  recipientId: string,
  shiftIds: string[],
  sentAt: Date,
  signups: SignupIndex
): boolean {
  return qualifyingSignupTime(recipientId, shiftIds, sentAt, signups) !== null;
}

interface SiteAccumulator {
  emails: number;
  successfulEmails: number;
  converted: number;
  batches: Set<string>;
  volunteers: Set<string>;
}

interface TrendAccumulator {
  label: string;
  batches: Set<string>;
  emails: number;
  delivered: number;
  converted: number;
}

/**
 * Roll raw log rows up into org totals, a per-site breakdown, and a monthly
 * trend. Pure (no DB, no clock) so it can be unit tested directly.
 *
 * When `location` names a specific site, only sends that covered that site are
 * counted, and the breakdown surfaces just that site.
 */
export function aggregateShortageLogs(
  logs: ShortageLogRow[],
  location: string | null = null,
  signups: SignupIndex = new Map()
): Omit<ShortageNotificationAnalytics, "periodMonths"> {
  const isSiteFiltered = !!location && location !== "all";
  const rows = isSiteFiltered
    ? logs.filter((row) => sitesForLog(row).includes(location as string))
    : logs;

  // ── Org totals ──────────────────────────────────────────────────────────
  const totalBatches = new Set<string>();
  const totalVolunteers = new Set<string>();
  let emails = 0;
  let successfulEmails = 0;
  let converted = 0;
  for (const row of rows) {
    emails += 1;
    totalBatches.add(batchKey(row));
    totalVolunteers.add(row.recipientId);
    if (row.success) {
      successfulEmails += 1;
      const shiftIds = [...shiftsByLocationForLog(row).values()].flat();
      if (convertedForShifts(row.recipientId, shiftIds, row.sentAt, signups)) {
        converted += 1;
      }
    }
  }
  const totals: ShortageTotals = {
    sendEvents: totalBatches.size,
    emails,
    successfulEmails,
    failedEmails: emails - successfulEmails,
    volunteersReached: totalVolunteers.size,
    successRate: percentage(successfulEmails, emails),
    converted,
    conversionRate: percentage(converted, successfulEmails),
  };

  // ── Per-site breakdown ──────────────────────────────────────────────────
  // Each row counts toward every distinct site its shifts covered; a conversion
  // is credited to the site of the shift the recipient actually signed up for.
  const siteMap = new Map<string, SiteAccumulator>();
  for (const row of rows) {
    const key = batchKey(row);
    for (const [site, shiftIds] of shiftsByLocationForLog(row)) {
      if (isSiteFiltered && site !== location) continue;
      let acc = siteMap.get(site);
      if (!acc) {
        acc = {
          emails: 0,
          successfulEmails: 0,
          converted: 0,
          batches: new Set(),
          volunteers: new Set(),
        };
        siteMap.set(site, acc);
      }
      acc.emails += 1;
      if (row.success) {
        acc.successfulEmails += 1;
        if (convertedForShifts(row.recipientId, shiftIds, row.sentAt, signups)) {
          acc.converted += 1;
        }
      }
      acc.batches.add(key);
      acc.volunteers.add(row.recipientId);
    }
  }
  const bySite: ShortageSiteRow[] = [...siteMap.entries()]
    .map(([site, acc]) => ({
      location: site,
      sendEvents: acc.batches.size,
      emails: acc.emails,
      successfulEmails: acc.successfulEmails,
      failedEmails: acc.emails - acc.successfulEmails,
      volunteersReached: acc.volunteers.size,
      successRate: percentage(acc.successfulEmails, acc.emails),
      converted: acc.converted,
      conversionRate: percentage(acc.converted, acc.successfulEmails),
    }))
    .sort(
      (a, b) => b.emails - a.emails || a.location.localeCompare(b.location)
    );

  // ── Monthly trend (NZ time) ─────────────────────────────────────────────
  const trendMap = new Map<string, TrendAccumulator>();
  // month → site → delivered alerts, for the stacked-by-location chart.
  const monthSiteDelivered = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const month = formatInNZT(row.sentAt, "yyyy-MM");
    let acc = trendMap.get(month);
    if (!acc) {
      acc = {
        label: formatInNZT(row.sentAt, "MMM yyyy"),
        batches: new Set(),
        emails: 0,
        delivered: 0,
        converted: 0,
      };
      trendMap.set(month, acc);
    }
    acc.batches.add(batchKey(row));
    acc.emails += 1;
    if (row.success) {
      acc.delivered += 1;
      const byLoc = shiftsByLocationForLog(row);
      const shiftIds = [...byLoc.values()].flat();
      if (convertedForShifts(row.recipientId, shiftIds, row.sentAt, signups)) {
        acc.converted += 1;
      }
      // A delivered alert counts toward each site it covered (as in bySite).
      let siteMonth = monthSiteDelivered.get(month);
      if (!siteMonth) {
        siteMonth = new Map();
        monthSiteDelivered.set(month, siteMonth);
      }
      for (const site of byLoc.keys()) {
        siteMonth.set(site, (siteMonth.get(site) ?? 0) + 1);
      }
    }
  }
  const trend: ShortageTrendPoint[] = [...trendMap.entries()]
    .map(([month, acc]) => ({
      month,
      label: acc.label,
      sendEvents: acc.batches.size,
      emails: acc.emails,
      deliveredEmails: acc.delivered,
      signups: acc.converted,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Per-location delivered series aligned to the sorted trend months; location
  // order follows bySite (busiest first) so chart and table agree.
  const monthOrder = trend.map((t) => t.month);
  const trendByLocation: ShortageTrendLocationSeries[] = bySite.map((site) => ({
    location: site.location,
    delivered: monthOrder.map(
      (month) => monthSiteDelivered.get(month)?.get(site.location) ?? 0
    ),
  }));

  return { totals, bySite, trend, trendByLocation };
}

/**
 * Fetch and aggregate shortage-notification history for the admin report.
 *
 * @param months Length of the trailing window; `0` means all time.
 * @param location A specific restaurant, or `null`/`"all"` for the whole org.
 */
export async function getShortageNotificationAnalytics(
  months: number,
  location: string | null = null
): Promise<ShortageNotificationAnalytics> {
  const now = new Date();
  let where = {};
  if (months > 0) {
    const periodStart = new Date(now);
    periodStart.setMonth(periodStart.getMonth() - months);
    where = { sentAt: { gte: periodStart, lte: now } };
  }

  const logs = (await prisma.shortageNotificationLog.findMany({
    where,
    select: {
      sentAt: true,
      sentBy: true,
      recipientId: true,
      success: true,
      shifts: true,
    },
  })) as ShortageLogRow[];

  // To measure effectiveness, look up whether each notified volunteer signed up
  // for the shift(s) they were alerted about. Collect the recipient/shift pairs
  // in play, fetch those signups, and index them by (userId, shiftId).
  const recipientIds = new Set<string>();
  const shiftIds = new Set<string>();
  for (const log of logs) {
    recipientIds.add(log.recipientId);
    for (const ids of shiftsByLocationForLog(log).values()) {
      for (const id of ids) shiftIds.add(id);
    }
  }

  let signups: SignupIndex = new Map();
  if (recipientIds.size > 0 && shiftIds.size > 0) {
    const rows = await prisma.signup.findMany({
      where: {
        userId: { in: [...recipientIds] },
        shiftId: { in: [...shiftIds] },
      },
      select: { userId: true, shiftId: true, createdAt: true },
    });
    signups = new Map(
      rows.map((row) => [signupKey(row.userId, row.shiftId), row.createdAt])
    );
  }

  const { totals, bySite, trend, trendByLocation } = aggregateShortageLogs(
    logs,
    location,
    signups
  );

  return { totals, bySite, trend, trendByLocation, periodMonths: months };
}

/** One volunteer who signed up for a shift after being alerted about it. */
export interface ShortageConversion {
  userId: string;
  name: string;
  email: string;
  profilePhotoUrl: string | null;
  shiftId: string;
  shiftTypeName: string;
  shiftLocation: string;
  /** ISO date of the shift they signed up for. */
  shiftDate: string;
  /** ISO timestamp of the earliest delivered alert about that shift. */
  notifiedAt: string;
  /** ISO timestamp of when they signed up. */
  signedUpAt: string;
  /** Whole days between the first alert and the signup (0 = same day). */
  daysToSignup: number;
}

export interface ShortageConversionsResult {
  conversions: ShortageConversion[];
  total: number;
  /** Max rows returned; `total` may exceed this. */
  cap: number;
}

const CONVERSIONS_CAP = 500;

/** Raw `shifts` entry shape when we need per-shift detail, not just the site. */
interface LoggedShiftDetail {
  shiftId?: string;
  shiftTypeName?: string;
  shiftDate?: string;
  shiftLocation?: string;
}

/**
 * The list behind the "signups from alerts" figure: volunteers who signed up
 * for a shift within {@link CONVERSION_WINDOW_DAYS} days of a delivered alert
 * about it. One row per distinct (volunteer, shift); when several alerts
 * covered the same shift, the earliest qualifying one is treated as the nudge.
 *
 * @param months Length of the trailing window; `0` means all time.
 * @param location A specific restaurant, or `null`/`"all"` for the whole org.
 */
export async function getShortageConversions(
  months: number,
  location: string | null = null
): Promise<ShortageConversionsResult> {
  const now = new Date();
  const where: { success: boolean; sentAt?: { gte: Date; lte: Date } } = {
    success: true,
  };
  if (months > 0) {
    const periodStart = new Date(now);
    periodStart.setMonth(periodStart.getMonth() - months);
    where.sentAt = { gte: periodStart, lte: now };
  }

  const logs = await prisma.shortageNotificationLog.findMany({
    where,
    select: {
      sentAt: true,
      recipientId: true,
      recipientName: true,
      recipientEmail: true,
      shifts: true,
    },
  });

  // Fetch signups for the notified (recipient, shift) pairs. We deliberately
  // fetch every status (including later-canceled ones): if a volunteer signed
  // up after an alert, the nudge worked regardless of a subsequent cancellation.
  const recipientIds = new Set<string>();
  const shiftIds = new Set<string>();
  for (const log of logs) {
    recipientIds.add(log.recipientId);
    const shifts = Array.isArray(log.shifts)
      ? (log.shifts as LoggedShiftDetail[])
      : [];
    for (const s of shifts) if (s?.shiftId) shiftIds.add(s.shiftId);
  }
  if (recipientIds.size === 0 || shiftIds.size === 0) {
    return { conversions: [], total: 0, cap: CONVERSIONS_CAP };
  }

  const signupRows = await prisma.signup.findMany({
    where: {
      userId: { in: [...recipientIds] },
      shiftId: { in: [...shiftIds] },
    },
    select: { userId: true, shiftId: true, createdAt: true },
  });
  const signups: SignupIndex = new Map(
    signupRows.map((row) => [signupKey(row.userId, row.shiftId), row.createdAt])
  );

  const isSiteFiltered = !!location && location !== "all";

  // Collapse to one entry per (volunteer, shift), keeping the earliest alert.
  interface Draft {
    userId: string;
    name: string;
    email: string;
    shiftId: string;
    shiftTypeName: string;
    shiftLocation: string;
    shiftDate: string;
    notifiedAt: Date;
    signedUpAt: Date;
  }
  const drafts = new Map<string, Draft>();
  for (const log of logs) {
    const shifts = Array.isArray(log.shifts)
      ? (log.shifts as LoggedShiftDetail[])
      : [];
    for (const s of shifts) {
      const shiftId = s?.shiftId;
      if (!shiftId) continue;
      const signedUpAt = signups.get(signupKey(log.recipientId, shiftId));
      if (!signedUpAt || !withinConversionWindow(log.sentAt, signedUpAt)) continue;

      const site = (s.shiftLocation ?? "").trim() || UNKNOWN_SITE;
      if (isSiteFiltered && site !== location) continue;

      const key = signupKey(log.recipientId, shiftId);
      const existing = drafts.get(key);
      if (existing) {
        // Earliest delivered alert is the nudge.
        if (log.sentAt.getTime() < existing.notifiedAt.getTime()) {
          existing.notifiedAt = log.sentAt;
        }
        continue;
      }
      drafts.set(key, {
        userId: log.recipientId,
        name: log.recipientName,
        email: log.recipientEmail,
        shiftId,
        shiftTypeName: s.shiftTypeName ?? "Shift",
        shiftLocation: site,
        shiftDate: s.shiftDate ?? signedUpAt.toISOString(),
        notifiedAt: log.sentAt,
        signedUpAt,
      });
    }
  }

  // Enrich with current name + photo from the User table.
  const userIds = [...new Set([...drafts.values()].map((d) => d.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      profilePhotoUrl: true,
    },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  const dayMs = 24 * 60 * 60 * 1000;
  const all = [...drafts.values()].map((d) => {
    const u = userById.get(d.userId);
    const currentName =
      u?.name ||
      [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim() ||
      d.name ||
      d.email;
    return {
      userId: d.userId,
      name: currentName,
      email: d.email,
      profilePhotoUrl: u?.profilePhotoUrl ?? null,
      shiftId: d.shiftId,
      shiftTypeName: d.shiftTypeName,
      shiftLocation: d.shiftLocation,
      shiftDate: d.shiftDate,
      notifiedAt: d.notifiedAt.toISOString(),
      signedUpAt: d.signedUpAt.toISOString(),
      daysToSignup: Math.max(
        0,
        Math.floor((d.signedUpAt.getTime() - d.notifiedAt.getTime()) / dayMs)
      ),
    } satisfies ShortageConversion;
  });

  // Most recent signups first.
  all.sort((a, b) => b.signedUpAt.localeCompare(a.signedUpAt));

  return {
    conversions: all.slice(0, CONVERSIONS_CAP),
    total: all.length,
    cap: CONVERSIONS_CAP,
  };
}

/** Per-volunteer responsiveness to shortage alerts (before User enrichment). */
export interface ShortageConverterCore {
  userId: string;
  name: string;
  email: string;
  /** Delivered alerts this volunteer received in the period. */
  alertsReceived: number;
  /** Of those, how many led to a signup within the crediting window. */
  signups: number;
  /** signups / alertsReceived as a 0–100 percentage. */
  conversionRate: number;
  /** ISO timestamp of their most recent qualifying signup, or null. */
  lastSignupAt: string | null;
}

/** A converting volunteer, enriched with profile photo for display. */
export interface ShortageConverter extends ShortageConverterCore {
  profilePhotoUrl: string | null;
}

export interface ShortageConvertersResult {
  converters: ShortageConverter[];
  total: number;
  /** Max rows returned; `total` may exceed this. */
  cap: number;
}

const CONVERTERS_CAP = 500;

interface ConverterAccumulator {
  userId: string;
  name: string;
  email: string;
  alertsReceived: number;
  signups: number;
  lastSignupAt: Date | null;
}

/**
 * Roll delivered alerts up per volunteer: how many alerts each received and how
 * many led to a signup within the crediting window. Only volunteers with at
 * least one signup are returned (the "converters"). Pure and DB-free so it can
 * be unit tested; the async wrapper adds profile photos.
 *
 * When `location` names a specific site, only alerts covering that site count,
 * and conversions are credited only for that site's shifts.
 */
export function aggregateConverters(
  logs: ShortageLogRow[],
  location: string | null,
  signups: SignupIndex
): ShortageConverterCore[] {
  const isSiteFiltered = !!location && location !== "all";
  const byUser = new Map<string, ConverterAccumulator>();

  for (const row of logs) {
    if (!row.success) continue;
    const byLoc = shiftsByLocationForLog(row);
    if (isSiteFiltered && !byLoc.has(location as string)) continue;

    let acc = byUser.get(row.recipientId);
    if (!acc) {
      acc = {
        userId: row.recipientId,
        name: row.recipientName ?? "",
        email: row.recipientEmail ?? "",
        alertsReceived: 0,
        signups: 0,
        lastSignupAt: null,
      };
      byUser.set(row.recipientId, acc);
    }
    acc.alertsReceived += 1;

    const shiftIds = isSiteFiltered
      ? byLoc.get(location as string) ?? []
      : [...byLoc.values()].flat();
    const signedUpAt = qualifyingSignupTime(
      row.recipientId,
      shiftIds,
      row.sentAt,
      signups
    );
    if (signedUpAt) {
      acc.signups += 1;
      if (
        !acc.lastSignupAt ||
        signedUpAt.getTime() > acc.lastSignupAt.getTime()
      ) {
        acc.lastSignupAt = signedUpAt;
      }
    }
  }

  return [...byUser.values()]
    .filter((acc) => acc.signups > 0)
    .map((acc) => ({
      userId: acc.userId,
      name: acc.name,
      email: acc.email,
      alertsReceived: acc.alertsReceived,
      signups: acc.signups,
      conversionRate: percentage(acc.signups, acc.alertsReceived),
      lastSignupAt: acc.lastSignupAt ? acc.lastSignupAt.toISOString() : null,
    }))
    .sort(
      (a, b) =>
        b.signups - a.signups ||
        b.conversionRate - a.conversionRate ||
        a.name.localeCompare(b.name)
    );
}

/**
 * The volunteers who respond to shortage alerts — one row each, ordered by
 * signups then conversion rate — for the "who converts" table and for building
 * a notification group of reliable responders.
 *
 * @param months Length of the trailing window; `0` means all time.
 * @param location A specific restaurant, or `null`/`"all"` for the whole org.
 */
export async function getShortageConverters(
  months: number,
  location: string | null = null
): Promise<ShortageConvertersResult> {
  const now = new Date();
  const where: { success: boolean; sentAt?: { gte: Date; lte: Date } } = {
    success: true,
  };
  if (months > 0) {
    const periodStart = new Date(now);
    periodStart.setMonth(periodStart.getMonth() - months);
    where.sentAt = { gte: periodStart, lte: now };
  }

  const logs = (await prisma.shortageNotificationLog.findMany({
    where,
    select: {
      sentAt: true,
      sentBy: true,
      recipientId: true,
      recipientName: true,
      recipientEmail: true,
      success: true,
      shifts: true,
    },
  })) as ShortageLogRow[];

  const recipientIds = new Set<string>();
  const shiftIds = new Set<string>();
  for (const log of logs) {
    recipientIds.add(log.recipientId);
    for (const ids of shiftsByLocationForLog(log).values()) {
      for (const id of ids) shiftIds.add(id);
    }
  }
  if (recipientIds.size === 0 || shiftIds.size === 0) {
    return { converters: [], total: 0, cap: CONVERTERS_CAP };
  }

  const signupRows = await prisma.signup.findMany({
    where: {
      userId: { in: [...recipientIds] },
      shiftId: { in: [...shiftIds] },
    },
    select: { userId: true, shiftId: true, createdAt: true },
  });
  const signups: SignupIndex = new Map(
    signupRows.map((row) => [signupKey(row.userId, row.shiftId), row.createdAt])
  );

  const core = aggregateConverters(logs, location, signups);

  // Enrich with current name + photo from the User table.
  const users = await prisma.user.findMany({
    where: { id: { in: core.map((c) => c.userId) } },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      profilePhotoUrl: true,
    },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  const converters: ShortageConverter[] = core.map((c) => {
    const u = userById.get(c.userId);
    const currentName =
      u?.name ||
      [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim() ||
      c.name ||
      c.email;
    return {
      ...c,
      name: currentName,
      profilePhotoUrl: u?.profilePhotoUrl ?? null,
    };
  });

  return {
    converters: converters.slice(0, CONVERTERS_CAP),
    total: converters.length,
    cap: CONVERTERS_CAP,
  };
}
