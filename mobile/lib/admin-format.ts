/**
 * Shared formatting helpers for the admin screens.
 */

/** Compact relative timestamp: "2:45 PM" today, "Mon", or "5 Jun". */
export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

/** "6:00 PM – 9:00 PM" for a shift window. */
export function formatTimeRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  return `${start.toLocaleTimeString([], opts)} – ${end.toLocaleTimeString([], opts)}`;
}

/** "Thursday, 5 June" for a shift day. */
export function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** First letter of a name, uppercased; falls back to a dot. */
export function initialOf(name: string | null | undefined): string {
  return (name?.trim()?.charAt(0) || "·").toUpperCase();
}

/** Grade pill colours, matching the volunteer-grade language used elsewhere. */
export const GRADE_COLORS: Record<
  "GREEN" | "YELLOW" | "PINK",
  { bg: string; fg: string; label: string }
> = {
  GREEN: { bg: "#D4E3D6", fg: "#163F2A", label: "Green" },
  YELLOW: { bg: "#FBFCB8", fg: "#6B5E00", label: "Yellow" },
  PINK: { bg: "#F8D7E3", fg: "#9B1C47", label: "Pink" },
};
