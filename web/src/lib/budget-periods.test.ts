import { describe, it, expect } from "vitest";
import {
  budgetPeriodBounds,
  budgetPeriodSearchParams,
  budgetYearsInPeriod,
  eachDayOfPeriod,
  formatDayRange,
  MAX_CUSTOM_RANGE_DAYS,
  resolveBudgetPeriod,
  switchBudgetPeriod,
  weekStartOf,
} from "./budget-periods";

// Thursday 26 Nov 2026, inside financial year 2026/27 (budget year 2027)
const TODAY = "2026-11-26";

describe("resolveBudgetPeriod", () => {
  it("defaults to the current financial year", () => {
    const p = resolveBudgetPeriod({}, TODAY);
    expect(p).toMatchObject({
      kind: "year",
      start: "2026-04-01",
      end: "2027-03-31",
      year: 2027,
      label: "2026/27",
      timing: "current",
      prev: null,
      next: null,
    });
  });

  it("opens a picked financial year", () => {
    const p = resolveBudgetPeriod({ year: "2026" }, TODAY);
    expect(p).toMatchObject({
      kind: "year",
      start: "2025-04-01",
      end: "2026-03-31",
      timing: "past",
    });
  });

  it("ignores an out-of-range year", () => {
    expect(resolveBudgetPeriod({ year: "1999" }, TODAY).year).toBe(2027);
    expect(resolveBudgetPeriod({ year: "nope" }, TODAY).year).toBe(2027);
  });

  it("shows the Monday-Sunday week around a date", () => {
    const p = resolveBudgetPeriod({ period: "week", date: "2026-11-26" }, TODAY);
    expect(p).toMatchObject({
      kind: "week",
      start: "2026-11-23",
      end: "2026-11-29",
      label: "23 – 29 Nov 2026",
      timing: "current",
      prev: "2026-11-16",
      next: "2026-11-30",
    });
  });

  it("defaults a week or month to the one containing today", () => {
    expect(resolveBudgetPeriod({ period: "week" }, TODAY).start).toBe(
      "2026-11-23"
    );
    expect(resolveBudgetPeriod({ period: "month" }, TODAY).start).toBe(
      "2026-11-01"
    );
  });

  it("shows a whole calendar month", () => {
    const p = resolveBudgetPeriod({ period: "month", date: "2028-02-10" }, TODAY);
    expect(p).toMatchObject({
      kind: "month",
      start: "2028-02-01",
      end: "2028-02-29",
      label: "February 2028",
      year: 2028,
      timing: "future",
      prev: "2028-01-31",
      next: "2028-03-01",
    });
  });

  it("puts a week that crosses 1 April in the year it ends in", () => {
    // Mon 30 Mar - Sun 5 Apr 2026
    const p = resolveBudgetPeriod({ period: "week", date: "2026-04-01" }, TODAY);
    expect(p.start).toBe("2026-03-30");
    expect(p.end).toBe("2026-04-05");
    expect(p.year).toBe(2027);
    expect(budgetYearsInPeriod(p)).toEqual([2026, 2027]);
  });

  it("takes a custom range, in either order", () => {
    const p = resolveBudgetPeriod(
      { period: "custom", from: "2026-10-15", to: "2026-09-01" },
      TODAY
    );
    expect(p).toMatchObject({
      kind: "custom",
      start: "2026-09-01",
      end: "2026-10-15",
      label: "1 Sep – 15 Oct 2026",
      timing: "past",
    });
  });

  it("clamps a custom range to three years ending on its last day", () => {
    const p = resolveBudgetPeriod(
      { period: "custom", from: "2000-01-01", to: "2026-11-26" },
      TODAY
    );
    expect(p.end).toBe("2026-11-26");
    expect(p.start).toBe("2023-11-27");
    expect(eachDayOfPeriod(p)).toHaveLength(MAX_CUSTOM_RANGE_DAYS);
  });

  it("keeps a custom range of exactly the cap", () => {
    const p = resolveBudgetPeriod(
      { period: "custom", from: "2023-11-27", to: "2026-11-26" },
      TODAY
    );
    expect(p.start).toBe("2023-11-27");
  });

  it("falls back to the year when a custom range is incomplete or invalid", () => {
    expect(
      resolveBudgetPeriod({ period: "custom", from: "2026-09-01" }, TODAY).kind
    ).toBe("year");
    expect(
      resolveBudgetPeriod(
        { period: "custom", from: "2026-02-30", to: "2026-03-10" },
        TODAY
      ).kind
    ).toBe("year");
  });

  it("ignores an invalid anchor date", () => {
    expect(
      resolveBudgetPeriod({ period: "month", date: "2026-13-01" }, TODAY).start
    ).toBe("2026-11-01");
  });
});

describe("weekStartOf", () => {
  it("finds the Monday on or before a day", () => {
    expect(weekStartOf("2026-11-23")).toBe("2026-11-23"); // Monday
    expect(weekStartOf("2026-11-29")).toBe("2026-11-23"); // Sunday
    expect(weekStartOf("2027-01-01")).toBe("2026-12-28"); // across a year
  });
});

describe("formatDayRange", () => {
  it("writes ranges compactly", () => {
    expect(formatDayRange("2026-11-23", "2026-11-29")).toBe("23 – 29 Nov 2026");
    expect(formatDayRange("2026-11-30", "2026-12-06")).toBe(
      "30 Nov – 6 Dec 2026"
    );
    expect(formatDayRange("2025-12-29", "2026-01-04")).toBe(
      "29 Dec 2025 – 4 Jan 2026"
    );
    expect(formatDayRange("2026-11-26", "2026-11-26")).toBe("26 Nov 2026");
  });
});

describe("budgetPeriodSearchParams", () => {
  it("round-trips every kind of period", () => {
    for (const params of [
      { year: "2026" },
      { period: "month", date: "2026-07-01" },
      { period: "week", date: "2026-11-23" },
      { period: "custom", from: "2026-09-01", to: "2026-10-15" },
    ]) {
      const p = resolveBudgetPeriod(params, TODAY);
      expect(budgetPeriodSearchParams(p)).toEqual(params);
    }
  });
});

describe("switchBudgetPeriod", () => {
  it("opens today's week or month from the current year", () => {
    const year = resolveBudgetPeriod({}, TODAY);
    expect(switchBudgetPeriod(year, "week", TODAY).start).toBe("2026-11-23");
    expect(switchBudgetPeriod(year, "month", TODAY).start).toBe("2026-11-01");
  });

  it("opens the last week or month of a past year", () => {
    const year = resolveBudgetPeriod({ year: "2026" }, TODAY);
    expect(switchBudgetPeriod(year, "month", TODAY).start).toBe("2026-03-01");
    expect(switchBudgetPeriod(year, "week", TODAY).start).toBe("2026-03-30");
  });

  it("starts a custom range on the dates in view", () => {
    const month = resolveBudgetPeriod({ period: "month", date: "2026-07-09" }, TODAY);
    expect(switchBudgetPeriod(month, "custom", TODAY)).toMatchObject({
      kind: "custom",
      start: "2026-07-01",
      end: "2026-07-31",
    });
  });

  it("goes back to the financial year the period ends in", () => {
    const week = resolveBudgetPeriod({ period: "week", date: "2026-03-31" }, TODAY);
    expect(switchBudgetPeriod(week, "year", TODAY)).toMatchObject({
      kind: "year",
      year: 2027,
    });
  });
});

describe("budgetPeriodBounds", () => {
  it("spans NZ midnight to the NZ midnight after the last day", () => {
    // NZDT (UTC+13) in November
    const { start, end } = budgetPeriodBounds({
      start: "2026-11-23",
      end: "2026-11-29",
    });
    expect(start.toISOString()).toBe("2026-11-22T11:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-29T11:00:00.000Z");
  });

  it("handles a week crossing the start of daylight saving", () => {
    // DST starts 27 Sep 2026: NZST (UTC+12) → NZDT (UTC+13)
    const { start, end } = budgetPeriodBounds({
      start: "2026-09-21",
      end: "2026-09-27",
    });
    expect(start.toISOString()).toBe("2026-09-20T12:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-27T11:00:00.000Z");
  });

  it("handles a month containing a daylight saving change", () => {
    // September 2026: starts on NZST, ends on NZDT
    const { start, end } = budgetPeriodBounds({
      start: "2026-09-01",
      end: "2026-09-30",
    });
    expect(start.toISOString()).toBe("2026-08-31T12:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-30T11:00:00.000Z");
  });

  it("handles a range crossing the end of daylight saving", () => {
    // DST ends 5 Apr 2026: NZDT (UTC+13) → NZST (UTC+12)
    const { start, end } = budgetPeriodBounds({
      start: "2026-03-30",
      end: "2026-04-05",
    });
    expect(start.toISOString()).toBe("2026-03-29T11:00:00.000Z");
    expect(end.toISOString()).toBe("2026-04-05T12:00:00.000Z");
  });
});

describe("eachDayOfPeriod", () => {
  it("lists every day, across a month end", () => {
    expect(eachDayOfPeriod({ start: "2026-02-27", end: "2026-03-02" })).toEqual([
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
      "2026-03-02",
    ]);
  });
});
