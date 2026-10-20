import { describe, expect, it } from "vitest";
import {
  buildCafeReport,
  buildEventsReport,
  rankedShares,
} from "./events-cafe-report";

describe("buildEventsReport", () => {
  it("totals every event's income and lists events newest first", () => {
    const report = buildEventsReport([
      {
        date: "2026-08-01",
        location: "Wellington",
        eventName: "Quiz night",
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
        eventName: null,
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
      events: 2,
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
      rankedShares({ A: 25, B: 0, C: 75 }, ["A", "B", "C"] as const)
    ).toEqual([
      { key: "C", amount: 75, share: 0.75 },
      { key: "A", amount: 25, share: 0.25 },
    ]);
  });
});
