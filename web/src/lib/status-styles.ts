/**
 * The one status colour map for the admin web.
 *
 * Every status chip, count badge and status-tinted panel picks one of five
 * tones instead of hand-rolling its own green/orange/blue classes, so
 * "pending" looks the same on the dashboard, in moderation and on a
 * volunteer's profile. Each pair is chosen to pass WCAG AA (4.5:1) for text
 * in both themes:
 *
 * - tinted: pale fill with dark text in light mode, translucent fill with
 *   light text in dark mode. The default for chips that sit beside content.
 * - solid: a 700-weight fill under white text, for small count badges that
 *   have to stand out in the sidebar or on a tab.
 *
 * Colour never carries the meaning alone: callers always render a text label
 * (and usually an icon) inside the chip.
 */

export type StatusTone =
  /** Done or good: confirmed signups, resolved reports, active rules. */
  | "confirmed"
  /** Waiting on an admin decision: pending signups, pending reports. */
  | "pending"
  /** Queued or in progress: waitlisted signups, reviewed reports. */
  | "waitlisted"
  /** Failed, cancelled, rejected or needing urgent action. */
  | "danger"
  /** Informational with no judgement: archived, draft, other. */
  | "neutral";

export const STATUS_TINTED: Record<StatusTone, string> = {
  confirmed:
    "border-forest-200 bg-primary-light text-forest-600 dark:border-forest-300/40 dark:text-primary-text",
  pending:
    "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/15 dark:text-amber-200",
  waitlisted:
    "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-400/30 dark:bg-sky-400/15 dark:text-sky-200",
  danger:
    "border-red-300 bg-red-50 text-red-800 dark:border-red-400/30 dark:bg-red-500/15 dark:text-red-200",
  neutral:
    "border-stone-300 bg-stone-100 text-stone-700 dark:border-white/15 dark:bg-white/10 dark:text-stone-200",
};

export const STATUS_SOLID: Record<StatusTone, string> = {
  confirmed: "bg-forest-500 text-white dark:bg-forest-400",
  pending: "bg-amber-700 text-white",
  waitlisted: "bg-sky-700 text-white",
  danger: "bg-red-700 text-white",
  neutral: "bg-stone-600 text-white",
};

/** Icon colour that sits on a card or tinted panel of the same tone. */
export const STATUS_ICON: Record<StatusTone, string> = {
  confirmed: "text-primary-text",
  pending: "text-amber-700 dark:text-amber-300",
  waitlisted: "text-sky-700 dark:text-sky-300",
  danger: "text-red-700 dark:text-red-300",
  neutral: "text-muted-foreground",
};

/** Signup statuses (the `SignupStatus` enum) mapped to a tone. */
const SIGNUP_STATUS_TONES: Record<string, StatusTone> = {
  CONFIRMED: "confirmed",
  REGULAR_PENDING: "pending",
  PENDING: "pending",
  WAITLISTED: "waitlisted",
  CANCELED: "danger",
  NO_SHOW: "danger",
  NOT_NEEDED: "neutral",
  UNAVAILABLE: "neutral",
};

/** Content report statuses mapped to a tone. */
const REPORT_STATUS_TONES: Record<string, StatusTone> = {
  PENDING: "pending",
  REVIEWED: "waitlisted",
  RESOLVED: "confirmed",
};

export function signupStatusTone(status: string): StatusTone {
  return SIGNUP_STATUS_TONES[status] ?? "neutral";
}

export function reportStatusTone(status: string): StatusTone {
  return REPORT_STATUS_TONES[status] ?? "neutral";
}

/** "NO_SHOW" → "No show", for status chips. */
export function formatStatusLabel(status: string): string {
  const words = status.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
