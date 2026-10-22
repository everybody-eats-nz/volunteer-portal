/**
 * Shared formatting helpers for the admin screens.
 */

import { Tones, type ToneName } from "@/constants/theme";

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

type Grade = "GREEN" | "YELLOW" | "PINK";
type GradePill = { bg: string; fg: string; label: string };

const GRADE_TONES: Record<Grade, { tone: ToneName; label: string }> = {
  GREEN: { tone: "forest", label: "Green" },
  YELLOW: { tone: "sun", label: "Yellow" },
  PINK: { tone: "pink", label: "Pink" },
};

function gradePills(scheme: "light" | "dark"): Record<Grade, GradePill> {
  const pills = {} as Record<Grade, GradePill>;
  for (const grade of Object.keys(GRADE_TONES) as Grade[]) {
    const { tone, label } = GRADE_TONES[grade];
    pills[grade] = { ...Tones[scheme][tone], label };
  }
  return pills;
}

/** Grade pill colours per scheme, matching the volunteer-grade language used elsewhere. */
export const GRADE_COLORS: Record<"light" | "dark", Record<Grade, GradePill>> = {
  light: gradePills("light"),
  dark: gradePills("dark"),
};
