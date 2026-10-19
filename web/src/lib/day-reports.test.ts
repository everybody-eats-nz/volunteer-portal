import { describe, expect, it } from "vitest";
import {
  formatDuration,
  formatTimeOfDay,
  gstPortion,
  openMinutes,
  summariseEventIncome,
} from "./day-reports";

describe("gstPortion", () => {
  it("takes 3/23 of a GST-inclusive amount", () => {
    expect(gstPortion(115)).toBe(15);
    expect(gstPortion(100)).toBe(13.04);
    expect(gstPortion(0)).toBe(0);
  });
});

describe("summariseEventIncome", () => {
  it("totals incl. and excl. GST, by category and by source", () => {
    const summary = summariseEventIncome([
      { source: "EFTPOS", category: "SALES", amount: 1150, gstIncluded: true },
      { source: "CASH", category: "SALES", amount: 230, gstIncluded: true },
      {
        source: "EFTPOS",
        category: "AUCTION",
        amount: 900.1,
        gstIncluded: false,
      },
      {
        source: "INVOICE",
        category: "DONATION",
        amount: 500,
        gstIncluded: false,
      },
      { source: "CASH", category: "KOHA", amount: 0.2, gstIncluded: false },
    ]);
    expect(summary.total).toBe(2780.3);
    expect(summary.gst).toBe(180); // 150 + 30
    expect(summary.totalExGst).toBe(2600.3);
    expect(summary.byCategory).toEqual({
      KOHA: 0.2,
      SALES: 1380,
      AUCTION: 900.1,
      DONATION: 500,
      OTHER: 0,
    });
    expect(summary.bySource).toEqual({
      CASH: 230.2,
      EFTPOS: 2050.1,
      STRIPE: 0,
      INVOICE: 500,
    });
  });

  it("is all zeroes with no lines", () => {
    const summary = summariseEventIncome([]);
    expect(summary).toMatchObject({ total: 0, gst: 0, totalExGst: 0 });
  });

  it("rounds GST per line, as on each receipt", () => {
    // 3 × $10 taxable: each line's GST is $1.30, not 3 × $1.3043 = $3.91.
    const line = {
      source: "CASH",
      category: "SALES",
      amount: 10,
      gstIncluded: true,
    } as const;
    expect(summariseEventIncome([line, line, line]).gst).toBe(3.9);
  });
});

describe("cafe opening hours", () => {
  it("counts minutes open when close follows open", () => {
    expect(openMinutes("07:30", "14:00")).toBe(390);
    expect(openMinutes("14:00", "07:30")).toBeNull();
    expect(openMinutes("07:30", null)).toBeNull();
    expect(openMinutes("7:30", "14:00")).toBeNull();
  });

  it("formats durations and times for people", () => {
    expect(formatDuration(390)).toBe("6h 30m");
    expect(formatDuration(420)).toBe("7h");
    expect(formatDuration(45)).toBe("45m");
    expect(formatTimeOfDay("07:30")).toBe("7:30am");
    expect(formatTimeOfDay("12:00")).toBe("12pm");
    expect(formatTimeOfDay("00:15")).toBe("12:15am");
    expect(formatTimeOfDay("17:00")).toBe("5pm");
  });
});
