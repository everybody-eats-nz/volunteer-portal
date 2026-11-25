import { describe, expect, it } from "vitest";
import {
  buildCafeReport,
  buildEventsReport,
  estimatesNote,
  rankedShares,
} from "./events-cafe-report";

describe("buildEventsReport", () => {
  it("totals every event's income and lists events newest first", () => {
    const report = buildEventsReport([
      {
        date: "2026-08-01",
        location: "Wellington",
        position: 0,
        kind: "EVENT",
        name: "Quiz night",
        pax: 80,
        income: [
          {
            source: "EFTPOS",
            category: "SALES",
            amount: 2300,
            gstIncluded: true,
          },
          { source: "CASH", category: "KOHA", amount: 150, gstIncluded: false },
        ],
        expenses: [
          { category: "FOOD", amount: 575, gstIncluded: true },
          { category: "STAFFING", amount: 400, gstIncluded: false },
        ],
      },
      {
        date: "2026-09-12",
        location: "Onehunga",
        position: 0,
        kind: "EVENT",
        name: null,
        pax: null,
        income: [],
        expenses: [],
      },
    ]);

    expect(report.rows.map((r) => r.date)).toEqual([
      "2026-09-12",
      "2026-08-01",
    ]);
    expect(report.rows[1]).toMatchObject({
      total: 2450,
      totalExGst: 2150,
      lineCount: 2,
      expenses: 975,
      expenseLineCount: 2,
      profit: 1475, // 2450 - 975
      profitExGst: 1250, // 2150 - (975 - 75)
    });
    expect(report.rows[0]).toMatchObject({
      total: 0,
      lineCount: 0,
      expenses: 0,
      profit: 0,
    });
    expect(report.totals).toMatchObject({
      activities: 2,
      byKind: { EVENT: 2, CATERING: 0 },
      pax: 80,
      total: 2450,
      gst: 300,
      totalExGst: 2150,
      expenses: 975,
      expensesExGst: 900,
      profit: 1475,
      profitExGst: 1250,
    });
    expect(report.totals.expensesByCategory.FOOD).toBe(575);
    expect(report.totals.bySource.EFTPOS).toBe(2300);
    expect(report.totals.byCategory.KOHA).toBe(150);
  });
});

describe("buildEventsReport with estimates", () => {
  it("keeps estimates in the totals and flags the events that have them", () => {
    const report = buildEventsReport([
      {
        date: "2026-12-05",
        location: "Wellington",
        position: 0,
        kind: "EVENT",
        name: "Christmas fundraiser",
        pax: null,
        income: [
          {
            source: "EFTPOS",
            category: "SALES",
            amount: 3000,
            gstIncluded: true,
            estimated: true,
          },
        ],
        expenses: [
          { category: "FOOD", amount: 800, gstIncluded: true, estimated: true },
          { category: "STAFFING", amount: 400, gstIncluded: false },
        ],
      },
      {
        date: "2026-11-26",
        location: "Wellington",
        position: 0,
        kind: "EVENT",
        name: "Quiz night",
        pax: 60,
        income: [
          { source: "CASH", category: "KOHA", amount: 500, gstIncluded: false },
        ],
        expenses: [],
      },
    ]);

    expect(report.rows[0]).toMatchObject({
      total: 3000,
      expenses: 1200,
      profit: 1800,
      incomeEstimates: 1,
      expenseEstimates: 1,
    });
    expect(report.rows[1]).toMatchObject({
      incomeEstimates: 0,
      expenseEstimates: 0,
    });
    expect(report.totals).toMatchObject({
      total: 3500,
      expenses: 1200,
      profit: 2300,
      activitiesWithEstimates: 1,
      incomeEstimates: 1,
      expenseEstimates: 1,
    });
  });
});

describe("buildEventsReport with several activities a day", () => {
  const gig = (position: number, name: string, amount: number) => ({
    date: "2026-11-20",
    location: "Wellington",
    position,
    kind: "CATERING" as const,
    name,
    pax: 40,
    income: [
      {
        source: "INVOICE" as const,
        category: "INVOICE" as const,
        amount,
        gstIncluded: true,
      },
    ],
    expenses: [],
  });

  it("lists each catering gig and event as its own row, in the day's order", () => {
    const report = buildEventsReport([
      gig(1, "Xero staff lunch", 1150),
      {
        ...gig(2, "Quiz night", 600),
        kind: "EVENT",
        pax: 70,
      },
      gig(0, "Board breakfast", 460),
      { ...gig(0, "Older gig", 230), date: "2026-11-01" },
    ]);

    expect(report.rows.map((r) => r.name)).toEqual([
      "Board breakfast",
      "Xero staff lunch",
      "Quiz night",
      "Older gig",
    ]);
    expect(report.totals).toMatchObject({
      activities: 4,
      byKind: { CATERING: 3, EVENT: 1 },
      pax: 190,
      total: 2440,
    });
  });
});

describe("estimatesNote", () => {
  it("says how many of the events and catering gigs include estimates", () => {
    expect(estimatesNote(1, 1)).toBe("Includes estimates");
    expect(estimatesNote(3, 3)).toBe("All 3 include estimates");
    expect(estimatesNote(1, 4)).toBe("1 of 4 includes estimates");
    expect(estimatesNote(2, 4)).toBe("2 of 4 include estimates");
  });
});

describe("buildCafeReport", () => {
  it("averages takings over days that recorded them", () => {
    const report = buildCafeReport([
      {
        date: "2026-10-01",
        location: "Wellington",
        opensAt: "07:30",
        closesAt: "14:00",
        customers: 40,
        cash: 120.5,
        eftpos: 279.5,
      },
      {
        date: "2026-10-02",
        location: "Wellington",
        opensAt: null,
        closesAt: null,
        customers: null,
        cash: null,
        eftpos: null,
      },
      {
        date: "2026-10-03",
        location: "Wellington",
        opensAt: "08:00",
        closesAt: "13:00",
        customers: null,
        cash: 100,
        eftpos: null,
      },
    ]);

    expect(report.rows.map((r) => r.total)).toEqual([100, null, 400]);
    // GST-inclusive takings: $100 holds $13.04 GST, $400 holds $52.17.
    expect(report.rows.map((r) => r.totalExGst)).toEqual([86.96, null, 347.83]);
    expect(report.rows[2].minutesOpen).toBe(390);
    expect(report.totals).toEqual({
      days: 3,
      customers: 40,
      minutesOpen: 690, // 6h 30m + 5h
      cash: 220.5,
      eftpos: 279.5,
      total: 500,
      totalExGst: 434.79, // day by day, so the table adds up
      gst: 65.21,
      perDay: 250, // two days with takings
      perCustomer: 10, // only the day with both: $400 / 40
    });
  });

  it("has no averages with nothing recorded", () => {
    expect(buildCafeReport([]).totals).toMatchObject({
      days: 0,
      perDay: null,
      perCustomer: null,
    });
  });
});

describe("rankedShares", () => {
  it("drops empty keys and sorts by amount", () => {
    expect(
      rankedShares({ A: 25, B: 0, C: 75 }, ["A", "B", "C"] as const),
    ).toEqual([
      { key: "C", amount: 75, share: 0.75 },
      { key: "A", amount: 25, share: 0.25 },
    ]);
  });
});
