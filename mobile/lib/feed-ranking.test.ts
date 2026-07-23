import { describe, expect, it } from "vitest";

import {
  nzDaysUntil,
  nzDaysUntilDateOnly,
  rankFeedItems,
  upcomingLabel,
} from "@/lib/feed-ranking";
import type { FeedItem } from "@/lib/dummy-data";

// 2026-07-16T00:00:00Z = midday Thursday 16 July in NZ (NZST, UTC+12).
const NOW = new Date("2026-07-16T00:00:00.000Z");

const interactions = {
  likeCount: 0,
  likedByMe: false,
  recentLikers: [],
  commentCount: 0,
};

const announcement = (id: string, timestamp: string): FeedItem => ({
  type: "announcement",
  id,
  title: id,
  body: "body",
  timestamp,
  author: "Admin",
  ...interactions,
});

const event = (
  id: string,
  eventDate: string,
  timestamp: string,
  pinned?: boolean
): FeedItem => ({
  type: "community_event",
  id,
  title: id,
  eventDate,
  url: "https://example.org",
  timestamp,
  pinned,
  ...interactions,
});

const menu = (id: string, serviceDate: string, timestamp: string): FeedItem => ({
  type: "daily_menu",
  id,
  menuId: id,
  location: "Wellington",
  serviceDate,
  starter: [],
  mains: [{ name: "Kai" }],
  drink: [],
  dessert: [],
  timestamp,
  ...interactions,
});

const ids = (items: FeedItem[]) => items.map((i) => i.id);

describe("nzDaysUntil", () => {
  it("returns 0 for an instant later the same NZ day", () => {
    // 07:00Z = 7pm NZ on the 16th
    expect(nzDaysUntil("2026-07-16T07:00:00.000Z", NOW)).toBe(0);
  });

  it("counts NZ calendar days, not 24h periods", () => {
    // 14:00Z on the 16th = 2am NZ on the 17th — tomorrow in NZ
    expect(nzDaysUntil("2026-07-16T14:00:00.000Z", NOW)).toBe(1);
    expect(nzDaysUntil("2026-07-19T06:00:00.000Z", NOW)).toBe(3);
  });

  it("returns negative for past days and NaN for garbage", () => {
    expect(nzDaysUntil("2026-07-14T06:00:00.000Z", NOW)).toBe(-2);
    expect(nzDaysUntil("not a date", NOW)).toBeNaN();
  });
});

describe("nzDaysUntilDateOnly", () => {
  it("reads the calendar day straight off the string", () => {
    expect(nzDaysUntilDateOnly("2026-07-16", NOW)).toBe(0);
    expect(nzDaysUntilDateOnly("2026-07-18T00:00:00.000Z", NOW)).toBe(2);
    expect(nzDaysUntilDateOnly("2026-07-14", NOW)).toBe(-2);
  });
});

describe("upcomingLabel", () => {
  it("labels the next week only", () => {
    expect(upcomingLabel(1)).toBe("Tomorrow");
    expect(upcomingLabel(3)).toBe("In 3 days");
    expect(upcomingLabel(7)).toBe("In 7 days");
  });

  it("returns null for today, the past, and beyond a week", () => {
    expect(upcomingLabel(0)).toBeNull();
    expect(upcomingLabel(-1)).toBeNull();
    expect(upcomingLabel(8)).toBeNull();
    expect(upcomingLabel(NaN)).toBeNull();
  });
});

describe("rankFeedItems", () => {
  it("keeps moment-anchored items in reverse-chronological order", () => {
    const sorted = rankFeedItems(
      [
        announcement("older", "2026-07-14T00:00:00.000Z"),
        announcement("newest", "2026-07-15T23:00:00.000Z"),
        announcement("oldest", "2026-07-10T00:00:00.000Z"),
      ],
      NOW
    );
    expect(ids(sorted)).toEqual(["newest", "older", "oldest"]);
  });

  it("pins today's events above everything, soonest first", () => {
    const sorted = rankFeedItems(
      [
        announcement("fresh-post", "2026-07-16T00:00:00.000Z"),
        event("gala-tonight", "2026-07-16T07:00:00.000Z", "2026-07-01T00:00:00.000Z", true),
        event("lunch-today", "2026-07-16T01:00:00.000Z", "2026-07-01T00:00:00.000Z", true),
      ],
      NOW
    );
    expect(ids(sorted)).toEqual(["lunch-today", "gala-tonight", "fresh-post"]);
  });

  it("climbs an imminent event above day-old content, but not above brand-new posts", () => {
    // Announced two weeks ago, happening in 2 days → sorts as ~12h old.
    const imminent = event(
      "imminent-event",
      "2026-07-18T06:00:00.000Z",
      "2026-07-02T00:00:00.000Z"
    );
    const sorted = rankFeedItems(
      [
        announcement("yesterday-post", "2026-07-15T00:00:00.000Z"),
        imminent,
        announcement("just-posted", "2026-07-15T23:30:00.000Z"),
      ],
      NOW
    );
    expect(ids(sorted)).toEqual(["just-posted", "imminent-event", "yesterday-post"]);
  });

  it("gives a freshly announced far-out event its news moment", () => {
    // Published an hour ago, happening in 30 days — publish time wins the max().
    const sorted = rankFeedItems(
      [
        announcement("yesterday-post", "2026-07-15T00:00:00.000Z"),
        event("far-out-event", "2026-08-15T06:00:00.000Z", "2026-07-15T23:00:00.000Z"),
      ],
      NOW
    );
    expect(ids(sorted)).toEqual(["far-out-event", "yesterday-post"]);
  });

  it("lets a far-out event sink between announcement and lead-in", () => {
    // Published 10 days ago, happening in 10 days → ramp (60h) loses to
    // fresher content from the last two days.
    const sorted = rankFeedItems(
      [
        event("far-out-event", "2026-07-26T06:00:00.000Z", "2026-07-06T00:00:00.000Z"),
        announcement("two-days-ago", "2026-07-14T06:00:00.000Z"),
      ],
      NOW
    );
    expect(ids(sorted)).toEqual(["two-days-ago", "far-out-event"]);
  });

  it("does not boost past events left in a stale cache", () => {
    const sorted = rankFeedItems(
      [
        event("past-event", "2026-07-10T06:00:00.000Z", "2026-07-01T00:00:00.000Z"),
        announcement("newer-post", "2026-07-14T00:00:00.000Z"),
      ],
      NOW
    );
    expect(ids(sorted)).toEqual(["newer-post", "past-event"]);
  });

  it("surfaces tonight's menu on service day", () => {
    // Posted three days ago for tonight's service → sorts as freshly posted.
    const sorted = rankFeedItems(
      [
        announcement("yesterday-post", "2026-07-15T20:00:00.000Z"),
        menu("tonights-menu", "2026-07-16", "2026-07-13T00:00:00.000Z"),
      ],
      NOW
    );
    expect(ids(sorted)).toEqual(["tonights-menu", "yesterday-post"]);
  });

  it("lets old menus age out chronologically", () => {
    const sorted = rankFeedItems(
      [
        menu("last-week-menu", "2026-07-09", "2026-07-08T00:00:00.000Z"),
        announcement("newer-post", "2026-07-12T00:00:00.000Z"),
      ],
      NOW
    );
    expect(ids(sorted)).toEqual(["newer-post", "last-week-menu"]);
  });
});
