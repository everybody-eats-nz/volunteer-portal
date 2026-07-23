import { formatNZT } from "@/lib/dates";
import type { FeedItem } from "@/lib/dummy-data";

/**
 * Feed ordering: hype-adjusted recency.
 *
 * The feed has two kinds of content. Moment-anchored items (achievements,
 * friend signups, recaps, announcements, journal posts) are most interesting
 * the moment they're posted, so they sort by publish time. Time-anchored
 * items (community events, daily menus) are most interesting as their date
 * approaches — an event should spike when announced, quieten down, then climb
 * back up the feed during the lead-in and peak on the day.
 *
 * Both behaviours fall out of one rule: every item sorts by an *effective*
 * timestamp, and a time-anchored item's effective timestamp is
 *
 *   max(publishedAt, now − daysUntil × 6h)
 *
 * The max() preserves the announcement-day spike; the ramp makes the item
 * sort as if freshly posted on the day itself, ~6h old the day before, ~42h
 * old a week out — climbing a little further up the feed each day without
 * ever permanently squatting on the top slot (which would train people to
 * scroll past it). Events happening today are the one exception: the server
 * flags them `pinned` and they always lead the feed, soonest first.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

// The tuning knob for how hard proximity pulls an item up the feed: each day
// closer to its date, it sorts 6h fresher. Revisit once feed impressions and
// taps are instrumented.
const HYPE_RAMP_MS_PER_DAY = 6 * 60 * 60 * 1000;

/** Parse a "yyyy-MM-dd" day key to a comparable UTC-midnight epoch. */
const dayKeyToMs = (dayKey: string): number =>
  Date.parse(`${dayKey}T00:00:00Z`);

const nzDayKey = (date: Date): string => formatNZT(date, "yyyy-MM-dd");

/**
 * NZ-calendar-day difference from `now` to an instant (ISO datetime):
 * 0 = today, 1 = tomorrow, negative = past. NaN for unparseable input.
 */
export function nzDaysUntil(date: string | Date, now: Date): number {
  const target = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(target.getTime())) return NaN;
  return Math.round(
    (dayKeyToMs(nzDayKey(target)) - dayKeyToMs(nzDayKey(now))) / DAY_MS
  );
}

/**
 * Same, for *date-only* values ("yyyy-MM-dd" or midnight-UTC ISO strings such
 * as a menu's service date). Like formatNZDateOnly, the calendar day is read
 * straight off the string with no timezone conversion.
 */
export function nzDaysUntilDateOnly(value: string, now: Date): number {
  return Math.round(
    (dayKeyToMs(value.slice(0, 10)) - dayKeyToMs(nzDayKey(now))) / DAY_MS
  );
}

/**
 * Short countdown label for a time-anchored card: "Tomorrow" or "In N days"
 * up to a week out. Null otherwise — today has its own treatment ("Happening
 * today" / "Tonight"), and beyond a week a countdown reads as noise, not hype.
 */
export function upcomingLabel(daysUntil: number): string | null {
  if (daysUntil === 1) return "Tomorrow";
  if (daysUntil >= 2 && daysUntil <= 7) return `In ${daysUntil} days`;
  return null;
}

function effectiveTime(item: FeedItem, now: Date): number {
  const posted = new Date(item.timestamp).getTime();
  let daysUntil: number | undefined;
  if (item.type === "community_event") {
    daysUntil = nzDaysUntil(item.eventDate, now);
  } else if (item.type === "daily_menu") {
    daysUntil = nzDaysUntilDateOnly(item.serviceDate, now);
  }
  // Past or unparseable dates get no boost — a stale cached event or an old
  // menu just ages out chronologically.
  if (daysUntil === undefined || !Number.isFinite(daysUntil) || daysUntil < 0) {
    return posted;
  }
  return Math.max(posted, now.getTime() - daysUntil * HYPE_RAMP_MS_PER_DAY);
}

/**
 * Order feed items for display: events happening today first (soonest first),
 * then everything else by hype-adjusted recency (see module comment).
 */
export function rankFeedItems(items: FeedItem[], now: Date = new Date()): FeedItem[] {
  return items
    .map((item) => ({ item, time: effectiveTime(item, now) }))
    .sort((a, b) => {
      const pinnedA = a.item.type === "community_event" && a.item.pinned === true;
      const pinnedB = b.item.type === "community_event" && b.item.pinned === true;
      if (pinnedA !== pinnedB) return pinnedA ? -1 : 1;
      if (
        pinnedA &&
        a.item.type === "community_event" &&
        b.item.type === "community_event"
      ) {
        return (
          new Date(a.item.eventDate).getTime() -
          new Date(b.item.eventDate).getTime()
        );
      }
      return b.time - a.time;
    })
    .map(({ item }) => item);
}
