import { describe, expect, it } from "vitest";
import {
  addDaysToKey,
  buildCashCopyText,
  buildCashNights,
  formatCashRange,
  isDateKey,
  parseCashRangeParams,
  resolveCashRange,
} from "./cash-reconciliation";

// Tuesday 6 October 2026
const TODAY = "2026-10-06";

describe("resolveCashRange", () => {
  it("since Monday runs from this week's Monday to today", () => {
    expect(resolveCashRange("this-week", TODAY)).toEqual({
      from: "2026-10-05",
      to: TODAY,
    });
  });

  it("treats Sunday as the end of the week, not the start", () => {
    expect(resolveCashRange("this-week", "2026-10-11")).toEqual({
      from: "2026-10-05",
      to: "2026-10-11",
    });
  });

  it("last week is the previous Monday to Sunday", () => {
    expect(resolveCashRange("last-week", TODAY)).toEqual({
      from: "2026-09-28",
      to: "2026-10-04",
    });
  });

  it("last 14 days includes today", () => {
    expect(resolveCashRange("14d", TODAY)).toEqual({
      from: "2026-09-23",
      to: TODAY,
    });
  });

  it("this month and last month", () => {
    expect(resolveCashRange("this-month", TODAY)).toEqual({
      from: "2026-10-01",
      to: TODAY,
    });
    expect(resolveCashRange("last-month", TODAY)).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
    expect(resolveCashRange("last-month", "2026-01-15")).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
  });

  it("is unaffected by the NZ daylight-saving change", () => {
    // NZ DST starts Sunday 27 September 2026.
    expect(addDaysToKey("2026-09-26", 2)).toBe("2026-09-28");
    expect(resolveCashRange("last-week", "2026-09-29")).toEqual({
      from: "2026-09-21",
      to: "2026-09-27",
    });
  });
});

describe("parseCashRangeParams", () => {
  it("uses a valid custom range over any preset", () => {
    expect(
      parseCashRangeParams(
        { range: "last-week", from: "2026-08-01", to: "2026-08-14" },
        TODAY
      )
    ).toEqual({ range: "custom", from: "2026-08-01", to: "2026-08-14" });
  });

  it("falls back to the preset when the custom range is invalid", () => {
    expect(
      parseCashRangeParams(
        { range: "last-week", from: "2026-08-14", to: "2026-08-01" },
        TODAY
      )
    ).toEqual({ range: "last-week", from: "2026-09-28", to: "2026-10-04" });
    expect(
      parseCashRangeParams({ from: "2026-02-30", to: "2026-03-01" }, TODAY)
        .range
    ).toBe("14d");
  });

  it("defaults to the last 14 days", () => {
    expect(parseCashRangeParams({ range: "bogus" }, TODAY)).toEqual({
      range: "14d",
      from: "2026-09-23",
      to: TODAY,
    });
  });
});

describe("isDateKey", () => {
  it("accepts real dates only", () => {
    expect(isDateKey("2026-10-06")).toBe(true);
    expect(isDateKey("2026-02-29")).toBe(false);
    expect(isDateKey("2026-10-6")).toBe(false);
    expect(isDateKey(undefined)).toBe(false);
  });
});

describe("buildCashNights", () => {
  it("lists nights oldest first and totals each method in cents", () => {
    const { nights, totals } = buildCashNights(
      [
        { date: "2026-10-01", cash: 0.1, eftpos: 50, stripe: null },
        { date: "2026-09-30", cash: 0.2, eftpos: 25.5, stripe: 12 },
      ],
      []
    );
    expect(nights.map((n) => n.date)).toEqual(["2026-09-30", "2026-10-01"]);
    expect(totals).toEqual({
      cash: 0.3,
      eftpos: 75.5,
      stripe: 12,
      nights: 2,
      flagged: 0,
    });
  });

  it("flags a recorded night with blank cash, but not an explicit $0", () => {
    const { nights, totals } = buildCashNights(
      [
        { date: "2026-09-30", cash: null, eftpos: 80, stripe: null },
        { date: "2026-10-01", cash: 0, eftpos: null, stripe: null },
      ],
      []
    );
    expect(nights.map((n) => n.status)).toEqual(["no-cash", "recorded"]);
    expect(totals.flagged).toBe(1);
  });

  it("adds nights where shifts ran but nothing was recorded", () => {
    const { nights, totals } = buildCashNights(
      [{ date: "2026-09-30", cash: 120, eftpos: null, stripe: null }],
      ["2026-09-30", "2026-10-01"]
    );
    expect(nights).toEqual([
      {
        date: "2026-09-30",
        cash: 120,
        eftpos: null,
        stripe: null,
        status: "recorded",
      },
      {
        date: "2026-10-01",
        cash: null,
        eftpos: null,
        stripe: null,
        status: "no-record",
      },
    ]);
    expect(totals).toMatchObject({ cash: 120, nights: 2, flagged: 1 });
  });
});

describe("formatCashRange", () => {
  it("drops the repeated year within one year", () => {
    expect(formatCashRange("2026-09-23", "2026-10-06")).toBe(
      "Wed 23 Sep – Tue 6 Oct 2026"
    );
    expect(formatCashRange("2025-12-29", "2026-01-04")).toBe(
      "Mon 29 Dec 2025 – Sun 4 Jan 2026"
    );
    expect(formatCashRange("2026-10-06", "2026-10-06")).toBe("Tue 6 Oct 2026");
  });
});

describe("buildCashCopyText", () => {
  it("lists each night's cash, flags blanks, and ends with the total", () => {
    const { nights, totals } = buildCashNights(
      [
        { date: "2026-09-30", cash: 1234.5, eftpos: null, stripe: null },
        { date: "2026-10-01", cash: null, eftpos: 10, stripe: null },
      ],
      ["2026-10-02"]
    );
    expect(
      buildCashCopyText({
        location: "Wellington",
        from: "2026-09-28",
        to: "2026-10-04",
        nights,
        totals,
      })
    ).toBe(
      [
        "Cash reconciliation - Wellington",
        "Mon 28 Sep – Sun 4 Oct 2026",
        "",
        "Wed 30 Sep 2026\t$1,234.50",
        "Thu 1 Oct 2026\tNo cash recorded",
        "Fri 2 Oct 2026\tNight not recorded",
        "",
        "Total cash\t$1,234.50",
        "Service nights\t3",
        "Nights with no cash recorded\t2",
      ].join("\n")
    );
  });
});
