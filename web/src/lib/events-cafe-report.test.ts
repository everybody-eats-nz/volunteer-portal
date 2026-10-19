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
      },
      {
        date: "2026-09-12",
        location: "Onehunga",
        eventName: null,
        pax: null,
        income: [],
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
    });
    expect(report.rows[0]).toMatchObject({ total: 0, lineCount: 0 });
    expect(report.totals).toMatchObject({
      events: 2,
      pax: 80,
      total: 2450,
      gst: 300,
      totalExGst: 2150,
    });
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
    expect(report.rows[2].minutesOpen).toBe(390);
    expect(report.totals).toEqual({
      days: 3,
      customers: 40,
      minutesOpen: 690, // 6h 30m + 5h
      cash: 220.5,
      eftpos: 279.5,
      total: 500,
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
