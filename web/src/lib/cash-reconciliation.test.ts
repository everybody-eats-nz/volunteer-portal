import { describe, expect, it } from "vitest";
import {
  addDaysToKey,
  buildCashCopyText,
  buildCashNights,
  cashDayTypeLabel,
  dayCashTakings,
  eventCashTakings,
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
        { date: "2026-10-01", type: "SERVICE_NIGHT", cash: 0.1, eftpos: 50, stripe: null },
        { date: "2026-09-30", type: "SERVICE_NIGHT", cash: 0.2, eftpos: 25.5, stripe: 12 },
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
      eventDays: 0,
      activities: [],
      cafeDays: 0,
    });
  });

  it("flags a recorded night with blank cash, but not an explicit $0", () => {
    const { nights, totals } = buildCashNights(
      [
        { date: "2026-09-30", type: "SERVICE_NIGHT", cash: null, eftpos: 80, stripe: null },
        { date: "2026-10-01", type: "SERVICE_NIGHT", cash: 0, eftpos: null, stripe: null },
      ],
      []
    );
    expect(nights.map((n) => n.status)).toEqual(["no-cash", "recorded"]);
    expect(totals.flagged).toBe(1);
  });

  it("adds nights where shifts ran but nothing was recorded", () => {
    const { nights, totals } = buildCashNights(
      [{ date: "2026-09-30", type: "SERVICE_NIGHT", cash: 120, eftpos: null, stripe: null }],
      ["2026-09-30", "2026-10-01"]
    );
    expect(nights).toEqual([
      {
        date: "2026-09-30",
        type: "SERVICE_NIGHT",
        activities: [],
        cash: 120,
        eftpos: null,
        stripe: null,
        status: "recorded",
      },
      {
        date: "2026-10-01",
        type: "SERVICE_NIGHT",
        activities: [],
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
        { date: "2026-09-30", type: "SERVICE_NIGHT", cash: 1234.5, eftpos: null, stripe: null },
        { date: "2026-10-01", type: "SERVICE_NIGHT", cash: null, eftpos: 10, stripe: null },
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
        "Days\t3",
        "Nights with no cash recorded\t2",
      ].join("\n")
    );
  });
});

describe("events, catering and cafe days", () => {
  it("lists them beside service nights, counted and labelled", () => {
    const data = {
      location: "Wellington",
      from: "2026-10-05",
      to: "2026-10-08",
      ...buildCashNights(
        [
          { date: "2026-10-05", type: "SERVICE_NIGHT", cash: 100, eftpos: 50, stripe: null },
          {
            date: "2026-10-06",
            type: "EVENT",
            activities: [{ kind: "EVENT", name: "Quiz night" }],
            cash: 300,
            eftpos: 0,
            stripe: null,
          },
          { date: "2026-10-07", type: "CAFE", cash: 80.5, eftpos: 120, stripe: null },
          {
            date: "2026-10-08",
            type: "SERVICE_NIGHT",
            activities: [{ kind: "CATERING", name: "Xero lunch" }],
            cash: 20,
            eftpos: 0,
            stripe: null,
          },
        ],
        []
      ),
    };
    expect(data.totals).toMatchObject({
      cash: 500.5,
      nights: 4,
      eventDays: 1,
      cafeDays: 1,
      activities: ["EVENT", "CATERING"],
    });
    expect(data.nights.map(cashDayTypeLabel)).toEqual([
      null,
      "Event · Quiz night",
      "Cafe",
      "Service night + Catering · Xero lunch",
    ]);
    expect(buildCashCopyText(data).split("\n")).toEqual([
      "Cash reconciliation - Wellington",
      "Mon 5 Oct – Thu 8 Oct 2026",
      "",
      "Mon 5 Oct 2026\t$100.00",
      "Tue 6 Oct 2026 (Event · Quiz night)\t$300.00",
      "Wed 7 Oct 2026 (Cafe)\t$80.50",
      "Thu 8 Oct 2026 (Service night + Catering · Xero lunch)\t$20.00",
      "",
      "Total cash\t$500.50",
      "Days\t4",
      "Events & catering days\t1",
      "Cafe days\t1",
      "Catering gigs\t1",
      "Events\t1",
    ]);
  });

  it("names a day of several activities by what was run", () => {
    expect(
      cashDayTypeLabel({
        type: "EVENT",
        activities: [
          { kind: "CATERING", name: "A" },
          { kind: "EVENT", name: "B" },
          { kind: "CATERING", name: null },
        ],
      })
    ).toBe("2 catering gigs and an event");
    expect(cashDayTypeLabel({ type: "EVENT", activities: [] })).toBe(
      "Events & catering"
    );
  });
});

describe("dayCashTakings", () => {
  const line = (
    source: "CASH" | "EFTPOS" | "STRIPE" | "INVOICE",
    amount: number,
    estimated = false
  ) => ({ source, category: "SALES" as const, amount, gstIncluded: true, estimated });

  it("adds a service night's catering takings to its koha", () => {
    expect(
      dayCashTakings(
        { type: "SERVICE_NIGHT", cash: 100.1, eftpos: 50, stripe: 20 },
        [line("CASH", 40.2), line("EFTPOS", 300), line("INVOICE", 1150)]
      )
    ).toEqual({ cash: 140.3, eftpos: 350, stripe: 20, cashMissing: false });
  });

  it("still flags a service night with no cash of its own", () => {
    expect(
      dayCashTakings(
        { type: "SERVICE_NIGHT", cash: null, eftpos: null, stripe: null },
        [line("CASH", 40)]
      )
    ).toEqual({ cash: 40, eftpos: 0, stripe: 0, cashMissing: true });
  });

  it("sums every activity on an events day, ignoring estimates", () => {
    expect(
      dayCashTakings({ type: "EVENT", cash: null, eftpos: null, stripe: null }, [
        line("CASH", 200),
        line("CASH", 50),
        line("CASH", 999, true),
      ])
    ).toEqual({ cash: 250, eftpos: 0, stripe: 0, cashMissing: false });
  });

  it("flags an events day with no actual income yet", () => {
    expect(
      dayCashTakings({ type: "EVENT", cash: null, eftpos: null, stripe: null }, [
        line("CASH", 999, true),
      ])
    ).toMatchObject({ cash: null, cashMissing: true });
  });
});

describe("eventCashTakings", () => {
  const line = (
    source: "CASH" | "EFTPOS" | "STRIPE" | "INVOICE",
    amount: number,
    estimated = false
  ) => ({ source, category: "SALES" as const, amount, gstIncluded: true, estimated });

  it("is unknown until any income is entered", () => {
    expect(eventCashTakings([])).toEqual({ cash: null, eftpos: null, stripe: null });
  });

  it("is still unknown while every line is an estimate", () => {
    expect(
      eventCashTakings([line("CASH", 500, true), line("EFTPOS", 3000, true)])
    ).toEqual({ cash: null, eftpos: null, stripe: null });
  });

  it("counts only the actual lines when estimates and actuals mix", () => {
    expect(
      eventCashTakings([
        line("CASH", 200),
        line("CASH", 500, true),
        line("EFTPOS", 3000, true),
        line("STRIPE", 40.5),
      ])
    ).toEqual({ cash: 200, eftpos: 0, stripe: 40.5 });
  });

  it("reads $0 cash, not unknown, once actual income without cash is in", () => {
    expect(eventCashTakings([line("INVOICE", 1150)])).toEqual({
      cash: 0,
      eftpos: 0,
      stripe: 0,
    });
  });

  it("counts every line once they are all made actual", () => {
    expect(
      eventCashTakings([line("CASH", 500), line("EFTPOS", 3000)])
    ).toEqual({ cash: 500, eftpos: 3000, stripe: 0 });
  });
});
