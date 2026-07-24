import { format } from "date-fns";

/** Serialized announcement row as the server page hands it to the client. */
export type Announcement = {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  createdAt: string;
  expiresAt: string | null;
  createdBy: string;
  targetLocations: string[];
  targetGrades: string[];
  targetLabelIds: string[];
  targetUserIds: string[];
  targetShiftIds: string[];
  targetActivityLocations: string[];
  targetActivityFrom: string | null;
  targetActivityTo: string | null;
  targetActivityMinShifts: number | null;
  targetActivityMaxShifts: number | null;
  sendEmail: boolean;
  emailSentAt: string | null;
  sendNotification: boolean;
  notificationSentAt: string | null;
  author: {
    id: string;
    name: string | null;
    firstName: string | null;
    email: string;
  };
};

export type LabelOption = {
  id: string;
  name: string;
  color: string;
  icon: string | null;
};

export type UserOption = {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
};

export type ShiftOption = {
  id: string;
  start: string;
  end: string;
  location: string | null;
  shiftTypeName: string;
  signupCount: number;
};

/** The request-body shape shared by recipient-count preview and create. */
export type TargetingDraft = {
  targetLocations: string[];
  targetGrades: string[];
  targetLabelIds: string[];
  targetUserIds: string[];
  targetShiftIds: string[];
  targetActivityLocations: string[];
  targetActivityFrom: string | null;
  targetActivityTo: string | null;
  targetActivityMinShifts: number | null;
  targetActivityMaxShifts: number | null;
};

export const VOLUNTEER_GRADES = [
  { value: "GREEN", label: "Green", description: "Standard volunteers" },
  { value: "YELLOW", label: "Yellow", description: "Experienced volunteers" },
  { value: "PINK", label: "Pink", description: "Shift leaders" },
] as const;

export function gradeLabel(value: string): string {
  return VOLUNTEER_GRADES.find((g) => g.value === value)?.label ?? value;
}

export function userDisplayName(u: UserOption): string {
  if (u.firstName && u.lastName) return `${u.firstName} ${u.lastName}`;
  return u.name || u.email;
}

export function authorDisplayName(a: Announcement["author"]): string {
  return a.firstName ?? a.name ?? a.email;
}

/** "or"-join for within-dimension lists: "Onehunga, Glen Innes or Wellington". */
export function orJoin(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;
}

/**
 * Plain-English summary of an announcement's shift-history targeting, e.g.
 * "worked 1+ shift at Onehunga since 24 Apr 2026" or "worked exactly 1
 * shift". Null when the dimension is off.
 */
export function describeActivityTargeting(t: {
  targetActivityLocations: string[];
  targetActivityFrom: string | null;
  targetActivityTo: string | null;
  targetActivityMinShifts: number | null;
  targetActivityMaxShifts: number | null;
}): string | null {
  const min = t.targetActivityMinShifts;
  if (min === null) return null;
  const max = t.targetActivityMaxShifts;

  const howMany =
    max === null
      ? `${min}+ shift${min === 1 ? "" : "s"}`
      : max === min
        ? `exactly ${min} shift${min === 1 ? "" : "s"}`
        : `${min}–${max} shifts`;

  const where =
    t.targetActivityLocations.length > 0
      ? ` at ${orJoin(t.targetActivityLocations)}`
      : "";
  const from = t.targetActivityFrom
    ? format(new Date(t.targetActivityFrom), "d MMM yyyy")
    : null;
  const to = t.targetActivityTo
    ? format(new Date(t.targetActivityTo), "d MMM yyyy")
    : null;
  const when = from
    ? to
      ? ` between ${from} and ${to}`
      : ` since ${from}`
    : to
      ? ` up to ${to}`
      : "";

  return `worked ${howMany}${where}${when}`;
}

/**
 * The audience as a list of human conditions (one per active dimension,
 * joined with AND by the caller). Empty list = everyone.
 */
export function audienceConditions(
  t: TargetingDraft,
  labels: LabelOption[]
): string[] {
  const parts: string[] = [];
  if (t.targetLocations.length > 0) {
    parts.push(`based in ${orJoin(t.targetLocations)}`);
  }
  const activity = describeActivityTargeting(t);
  if (activity) parts.push(activity);
  if (t.targetGrades.length > 0) {
    parts.push(`${orJoin(t.targetGrades.map(gradeLabel))} grade`);
  }
  if (t.targetLabelIds.length > 0) {
    const names = t.targetLabelIds.map(
      (id) => labels.find((l) => l.id === id)?.name ?? "a label"
    );
    parts.push(`labelled ${orJoin(names)}`);
  }
  if (t.targetUserIds.length > 0) {
    parts.push(
      t.targetUserIds.length === 1
        ? "1 chosen volunteer"
        : `${t.targetUserIds.length} chosen volunteers`
    );
  }
  if (t.targetShiftIds.length > 0) {
    parts.push(
      `signed up to ${t.targetShiftIds.length} chosen shift${t.targetShiftIds.length === 1 ? "" : "s"}`
    );
  }
  return parts;
}

/** One-line audience summary for list rows. */
export function audienceSummary(
  ann: Announcement,
  labels: LabelOption[]
): string {
  const parts = audienceConditions(ann, labels);
  return parts.length > 0 ? parts.join(" · ") : "All volunteers";
}

/**
 * Rough markdown-to-text for one-line previews: drops images, unwraps links,
 * strips emphasis/heading/list markers and collapses whitespace.
 */
export function stripMarkdown(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`{1,3}[^`]*`{1,3}/g, (m) => m.replace(/`/g, ""))
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isExpired(ann: Announcement): boolean {
  return ann.expiresAt ? new Date(ann.expiresAt) < new Date() : false;
}

/** True when the announcement leaves the feed within the next `hours`. */
export function expiresWithin(ann: Announcement, hours: number): boolean {
  if (!ann.expiresAt) return false;
  const remaining = new Date(ann.expiresAt).getTime() - Date.now();
  return remaining > 0 && remaining < hours * 3_600_000;
}

export function parseCsv(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
