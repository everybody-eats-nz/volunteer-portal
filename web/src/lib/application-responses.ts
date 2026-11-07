/**
 * Shift application response times.
 *
 * The team has committed to answering every shift application within 48
 * hours. An application is a volunteer's own signup that needed a decision
 * (`Signup.appliedAt` set); the first decision on it is recorded in
 * `respondedAt` / `response`, whether a person made it or the auto-approval
 * rules did.
 *
 * Only the team's answers count toward the 48-hour target. Auto-approvals are
 * instant and would flatter it, so they are reported alongside, not inside.
 *
 * Pure aggregation lives here so it can be tested; the page does the query.
 */

export const RESPONSE_TARGET_HOURS = 48;
const HOUR_MS = 60 * 60 * 1000;

export type ApplicationResponse =
  | "APPROVED"
  | "AUTO_APPROVED"
  | "WAITLISTED"
  | "DECLINED";

export interface ApplicationRecord {
  appliedAt: Date;
  respondedAt: Date | null;
  response: ApplicationResponse | null;
  status: string;
  location: string | null;
  shiftStart: Date;
}

/** Where one application ended up, for the report's purposes. */
export type ApplicationOutcome =
  | { kind: "auto" }
  | { kind: "answered"; hours: number; response: ApplicationResponse }
  /** Still pending and the shift hasn't started. */
  | { kind: "waiting"; hours: number }
  /** Still pending, but the shift has been and gone. Never answered. */
  | { kind: "missed" }
  /**
   * Closed with no response on record: the volunteer withdrew, a clashing
   * shift was confirmed, or it was decided before response times were kept.
   */
  | { kind: "closed" };

export function classifyApplication(
  app: ApplicationRecord,
  now: Date
): ApplicationOutcome {
  if (app.response === "AUTO_APPROVED") return { kind: "auto" };
  if (app.respondedAt && app.response) {
    return {
      kind: "answered",
      hours: (app.respondedAt.getTime() - app.appliedAt.getTime()) / HOUR_MS,
      response: app.response,
    };
  }
  if (app.status === "PENDING") {
    if (app.shiftStart <= now) return { kind: "missed" };
    return {
      kind: "waiting",
      hours: (now.getTime() - app.appliedAt.getTime()) / HOUR_MS,
    };
  }
  return { kind: "closed" };
}

export interface ResponseStats {
  applications: number;
  autoApproved: number;
  /** Answered by a person, whenever. */
  answered: number;
  answeredOnTime: number;
  answeredLate: number;
  approved: number;
  waitlisted: number;
  declined: number;
  /** Pending, shift still ahead. */
  waiting: number;
  /** Pending for longer than the target - the team's backlog. */
  waitingOverdue: number;
  /** Pending until the shift started. */
  missed: number;
  closedWithoutResponse: number;
  /**
   * Share of applications that came due and were answered in time. Due means
   * answered (at any point), overdue, or missed; anything still inside the
   * window isn't late yet. Null when nothing has come due.
   */
  onTimeRate: number | null;
  medianResponseHours: number | null;
  /** Declined as a share of the team's answers. Null with no answers. */
  declineRate: number | null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function pct(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

export function summariseApplications(
  apps: ApplicationRecord[],
  now: Date
): ResponseStats {
  const stats: ResponseStats = {
    applications: apps.length,
    autoApproved: 0,
    answered: 0,
    answeredOnTime: 0,
    answeredLate: 0,
    approved: 0,
    waitlisted: 0,
    declined: 0,
    waiting: 0,
    waitingOverdue: 0,
    missed: 0,
    closedWithoutResponse: 0,
    onTimeRate: null,
    medianResponseHours: null,
    declineRate: null,
  };
  const hours: number[] = [];

  for (const app of apps) {
    const outcome = classifyApplication(app, now);
    switch (outcome.kind) {
      case "auto":
        stats.autoApproved++;
        break;
      case "answered":
        stats.answered++;
        hours.push(outcome.hours);
        if (outcome.hours <= RESPONSE_TARGET_HOURS) stats.answeredOnTime++;
        else stats.answeredLate++;
        if (outcome.response === "DECLINED") stats.declined++;
        else if (outcome.response === "WAITLISTED") stats.waitlisted++;
        else stats.approved++;
        break;
      case "waiting":
        stats.waiting++;
        if (outcome.hours > RESPONSE_TARGET_HOURS) stats.waitingOverdue++;
        break;
      case "missed":
        stats.missed++;
        break;
      case "closed":
        stats.closedWithoutResponse++;
        break;
    }
  }

  const due =
    stats.answered + stats.waitingOverdue + stats.missed;
  stats.onTimeRate = pct(stats.answeredOnTime, due);
  stats.medianResponseHours = median(hours);
  stats.declineRate = pct(stats.declined, stats.answered);
  return stats;
}

export interface LocationResponseStats extends ResponseStats {
  location: string;
}

/** Per-restaurant stats, busiest first. Shifts with no location group as "No location". */
export function summariseByLocation(
  apps: ApplicationRecord[],
  now: Date
): LocationResponseStats[] {
  const groups = new Map<string, ApplicationRecord[]>();
  for (const app of apps) {
    const key = app.location ?? "No location";
    const list = groups.get(key);
    if (list) list.push(app);
    else groups.set(key, [app]);
  }
  return [...groups.entries()]
    .map(([location, list]) => ({
      location,
      ...summariseApplications(list, now),
    }))
    .sort(
      (a, b) =>
        b.applications - a.applications || a.location.localeCompare(b.location)
    );
}

/** "35 min", "6 h", "2.5 days" - response times read best in the unit they're in. */
export function formatResponseHours(hours: number | null): string {
  if (hours === null) return "-";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${Math.round(hours)} h`;
  const days = hours / 24;
  return `${days < 10 ? days.toFixed(1).replace(/\.0$/, "") : Math.round(days)} days`;
}
