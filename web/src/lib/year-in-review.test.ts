import { describe, expect, it } from "vitest";
import {
  greetingName,
  nightKey,
  nzDayRange,
  nzYearRange,
  rankByCount,
  rankFriendsByNights,
  summariseShifts,
  topPercent,
} from "@/lib/year-in-review";

/** A shift starting at the given NZ wall-clock time (NZDT, UTC+13 in Jan). */
const shift = (
  utcStart: string,
  hours: number,
  location: string | null,
  role: string
) => {
  const start = new Date(utcStart);
  return {
    start,
    end: new Date(start.getTime() + hours * 3_600_000),
    location,
    role,
  };
};

describe("nzYearRange", () => {
  it("spans NZ midnight to NZ midnight", () => {
    const { start, end } = nzYearRange(2026);
    expect(start.toISOString()).toBe("2025-12-31T11:00:00.000Z");
    expect(end.toISOString()).toBe("2026-12-31T11:00:00.000Z");
  });
});

describe("nzDayRange", () => {
  it("covers one NZ day, across a DST change", () => {
    // NZ daylight saving ends on Sunday 5 April 2026.
    const { start, end } = nzDayRange("2026-04-05");
    expect(start.toISOString()).toBe("2026-04-04T11:00:00.000Z");
    expect(end.toISOString()).toBe("2026-04-05T12:00:00.000Z");
  });
});

describe("nightKey", () => {
  it("keys by the NZ day, not the UTC day", () => {
    // 10:30am UTC on 6 Feb is 11:30pm NZ on 6 Feb; 11:30am UTC is 7 Feb NZ.
    expect(nightKey(new Date("2026-02-06T10:30:00Z"), "Wellington")).toBe(
      "2026-02-06|Wellington"
    );
    expect(nightKey(new Date("2026-02-06T11:30:00Z"), "Wellington")).toBe(
      "2026-02-07|Wellington"
    );
  });
});

describe("rankByCount", () => {
  it("sorts busiest first, then alphabetically", () => {
    expect(rankByCount(["b", "a", "c", "c", "a"])).toEqual([
      { name: "a", count: 2 },
      { name: "c", count: 2 },
      { name: "b", count: 1 },
    ]);
  });
});

describe("summariseShifts", () => {
  const shifts = [
    // Fri 6 Feb 2026, 5:30pm NZ
    shift("2026-02-06T04:30:00Z", 3.5, "Wellington", "Kitchen Prep"),
    // Fri 13 Feb 2026, 5:30pm NZ, two shifts on the same night
    shift("2026-02-13T04:30:00Z", 3, "Wellington", "Dishwasher"),
    shift("2026-02-13T07:30:00Z", 2, "Wellington", "Kitchen Prep"),
    // Tue 3 Mar 2026, 5pm NZ
    shift("2026-03-03T04:00:00Z", 3, "Onehunga", "Kitchen Prep"),
  ];

  it("counts shifts, distinct nights and hours", () => {
    const summary = summariseShifts(shifts);
    expect(summary.completed).toBe(4);
    expect(summary.nights).toBe(3);
    // 11.5 hours, rounded down for display
    expect(summary.hours).toBe(11);
  });

  it("finds the first shift regardless of input order", () => {
    const summary = summariseShifts([...shifts].reverse());
    expect(summary.first).toEqual({
      date: "2026-02-06T04:30:00.000Z",
      location: "Wellington",
      role: "Kitchen Prep",
    });
  });

  it("buckets months and weekdays in NZ time", () => {
    const summary = summariseShifts(shifts);
    expect(summary.months.slice(0, 4)).toEqual([0, 3, 1, 0]);
    expect(summary.busiestMonth).toBe(1);
    expect(summary.favouriteWeekday).toBe(5);
    expect(summary.favouriteWeekdayCount).toBe(3);
  });

  it("ranks roles and locations", () => {
    const summary = summariseShifts(shifts);
    expect(summary.roles[0]).toEqual({ name: "Kitchen Prep", count: 3 });
    expect(summary.locations).toEqual([
      { name: "Wellington", count: 3 },
      { name: "Onehunga", count: 1 },
    ]);
  });

  it("leaves shifts without a location out of the location ranking", () => {
    const summary = summariseShifts([
      shift("2026-02-06T04:30:00Z", 3, null, "Media Role"),
    ]);
    expect(summary.locations).toEqual([]);
  });
});

describe("topPercent", () => {
  const everyone = Array.from({ length: 100 }, (_, i) => i + 1);

  it("puts the busiest volunteer in the top 1%", () => {
    expect(topPercent(100, everyone)).toBe(1);
  });

  it("gives tied volunteers the better rank", () => {
    expect(topPercent(10, [10, 10, 10, 1])).toBe(25);
  });

  it("stays quiet outside the top quarter", () => {
    expect(topPercent(76, everyone)).toBe(25);
    expect(topPercent(75, everyone)).toBeNull();
  });

  it("handles nobody volunteering", () => {
    expect(topPercent(0, [])).toBeNull();
  });
});

describe("rankFriendsByNights", () => {
  it("ranks friends by distinct shared nights", () => {
    const friends = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const ranked = rankFriendsByNights(friends, [
      { userId: "a", night: "n1" },
      { userId: "b", night: "n1" },
      { userId: "b", night: "n2" },
      // Two shifts on the same night count once
      { userId: "b", night: "n2" },
      { userId: "stranger", night: "n1" },
    ]);
    expect(ranked).toEqual([
      { id: "b", nights: 2 },
      { id: "a", nights: 1 },
    ]);
  });
});

describe("greetingName", () => {
  it("prefers the first name", () => {
    expect(greetingName({ firstName: " Mere ", name: "Mere Smith" })).toBe(
      "Mere"
    );
  });

  it("falls back to the first word of the full name", () => {
    expect(greetingName({ firstName: null, name: "Sam Taylor" })).toBe("Sam");
  });

  it("falls back to a friendly default", () => {
    expect(greetingName({ firstName: "", name: null })).toBe("there");
  });
});
