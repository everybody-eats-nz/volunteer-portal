import { TZDate } from "@date-fns/tz";
import { formatInNZT, toNZT } from "@/lib/timezone";
import { displayHours, totalShiftHours } from "@/lib/volunteer-hours";

/**
 * Pure aggregation for the volunteer "Year in mahi" video. The Prisma side
 * lives in `year-in-review.server.ts`; everything here works on plain rows so
 * it can be unit tested.
 */

const NZ_TIMEZONE = "Pacific/Auckland";

/** Only show "top X%" when it's something to celebrate. */
export const TOP_PERCENT_THRESHOLD = 25;

export type CompletedShift = {
  start: Date;
  end: Date;
  location: string | null;
  role: string;
};

export type Ranked = { name: string; count: number };

/** [start, end) of a calendar year in NZ time, as UTC instants. */
export function nzYearRange(year: number): { start: Date; end: Date } {
  return {
    start: new Date(new TZDate(year, 0, 1, NZ_TIMEZONE).getTime()),
    end: new Date(new TZDate(year + 1, 0, 1, NZ_TIMEZONE).getTime()),
  };
}

/** [start, end) of one NZ calendar day ("yyyy-MM-dd"), as UTC instants. */
export function nzDayRange(day: string): { start: Date; end: Date } {
  const [y, m, d] = day.split("-").map(Number);
  return {
    start: new Date(new TZDate(y, m - 1, d, NZ_TIMEZONE).getTime()),
    end: new Date(new TZDate(y, m - 1, d + 1, NZ_TIMEZONE).getTime()),
  };
}

/**
 * Identifies one service night: the NZ day a shift starts on plus its
 * restaurant. Matches how MealsServed keys its day reports.
 */
export function nightKey(date: Date, location: string | null): string {
  return `${formatInNZT(date, "yyyy-MM-dd")}|${location ?? ""}`;
}

/** Counts by name, busiest first, ties broken alphabetically. */
export function rankByCount(names: Iterable<string>): Ranked[] {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Index of the largest value; the earliest wins a tie. */
function indexOfMax(values: number[]): number {
  return values.reduce((best, v, i) => (v > values[best] ? i : best), 0);
}

export function summariseShifts(shifts: CompletedShift[]) {
  const sorted = [...shifts].sort(
    (a, b) => a.start.getTime() - b.start.getTime()
  );
  const months = Array<number>(12).fill(0);
  const weekdays = Array<number>(7).fill(0);
  for (const shift of sorted) {
    const nz = toNZT(shift.start);
    months[nz.getMonth()]++;
    weekdays[nz.getDay()]++;
  }
  const favouriteWeekday = indexOfMax(weekdays);
  const first = sorted[0];

  return {
    completed: sorted.length,
    hours: displayHours(totalShiftHours(sorted)),
    nights: new Set(sorted.map((s) => nightKey(s.start, s.location))).size,
    first: first
      ? {
          date: first.start.toISOString(),
          location: first.location,
          role: first.role,
        }
      : null,
    months,
    busiestMonth: indexOfMax(months),
    favouriteWeekday,
    favouriteWeekdayCount: weekdays[favouriteWeekday],
    roles: rankByCount(sorted.map((s) => s.role)),
    locations: rankByCount(
      sorted.flatMap((s) => (s.location ? [s.location] : []))
    ),
  };
}

/**
 * "Top X%" by completed shifts among everyone who volunteered this year.
 * Volunteers tied on the same count share the better rank. Returns null when
 * the volunteer sits outside {@link TOP_PERCENT_THRESHOLD}, so the video only
 * mentions it when it's worth celebrating.
 */
export function topPercent(mine: number, everyone: number[]): number | null {
  if (everyone.length === 0 || mine <= 0) return null;
  const ahead = everyone.filter((count) => count > mine).length;
  const percent = Math.max(1, Math.ceil(((ahead + 1) / everyone.length) * 100));
  return percent <= TOP_PERCENT_THRESHOLD ? percent : null;
}

/**
 * Friends ranked by how many of the volunteer's nights they also worked.
 * `coVolunteerNights` holds one entry per (other volunteer, night) pair.
 */
export function rankFriendsByNights<T extends { id: string }>(
  friends: T[],
  coVolunteerNights: { userId: string; night: string }[],
  limit = 3
): (T & { nights: number })[] {
  const nightsByUser = new Map<string, Set<string>>();
  for (const { userId, night } of coVolunteerNights) {
    const nights = nightsByUser.get(userId) ?? new Set<string>();
    nights.add(night);
    nightsByUser.set(userId, nights);
  }
  return friends
    .map((friend) => ({
      ...friend,
      nights: nightsByUser.get(friend.id)?.size ?? 0,
    }))
    .filter((friend) => friend.nights > 0)
    .sort((a, b) => b.nights - a.nights)
    .slice(0, limit);
}

/** First name for the greeting, falling back gracefully. */
export function greetingName(user: {
  firstName: string | null;
  name: string | null;
}): string {
  return (
    user.firstName?.trim() || user.name?.trim().split(/\s+/)[0] || "there"
  );
}
