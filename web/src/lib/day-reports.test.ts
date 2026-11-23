import { describe, expect, it } from "vitest";
import {
  describeActivities,
  peopleServed,
  formatDuration,
  formatTimeOfDay,
  gstPortion,
  eventProfit,
  openMinutes,
  profitLabel,
  summariseEventExpenses,
  summariseEventIncome,
} from "./day-reports";

describe("summariseEventExpenses", () => {
  it("totals incl. and excl. GST, by category", () => {
    const summary = summariseEventExpenses([
      { category: "STAFFING", amount: 600, gstIncluded: false },
      { category: "EQUIPMENT_HIRE", amount: 345, gstIncluded: true },
      { category: "DRINKS", amount: 230, gstIncluded: true },
      { category: "DRINKS", amount: 11.5, gstIncluded: true },
    ]);
    expect(summary.total).toBe(1186.5);
    expect(summary.gst).toBe(76.5); // 45 + 30 + 1.5
    expect(summary.totalExGst).toBe(1110);
    expect(summary.byCategory).toEqual({
      STAFFING: 600,
      FOOD: 0,
      LICENCES: 0,
      EQUIPMENT_HIRE: 345,
      DECOR: 0,
      DRINKS: 241.5,
      OTHER: 0,
    });
  });
});

describe("estimated lines", () => {
  it("count in the totals and are counted apart", () => {
    const income = summariseEventIncome([
      {
        source: "EFTPOS",
        category: "SALES",
        amount: 2300,
        gstIncluded: true,
        estimated: true,
      },
      { source: "CASH", category: "KOHA", amount: 200, gstIncluded: false },
    ]);
    expect(income.total).toBe(2500);
    expect(income.gst).toBe(300);
    expect(income.estimatedLines).toBe(1);

    const expenses = summariseEventExpenses([
      { category: "FOOD", amount: 115, gstIncluded: true, estimated: true },
      { category: "DECOR", amount: 50, gstIncluded: false, estimated: true },
    ]);
    expect(expenses.total).toBe(165);
    expect(expenses.estimatedLines).toBe(2);

    expect(summariseEventExpenses([]).estimatedLines).toBe(0);
  });
});

describe("profitLabel", () => {
  it("says profit or loss, as an estimate when it includes one", () => {
    expect(profitLabel(10)).toBe("Profit");
    expect(profitLabel(0)).toBe("Profit");
    expect(profitLabel(-1)).toBe("Loss");
    expect(profitLabel(10, true)).toBe("Estimated profit");
    expect(profitLabel(-1, true)).toBe("Estimated loss");
  });
});

describe("eventProfit", () => {
  it("takes expenses off income, as entered and excl. GST", () => {
    expect(
      eventProfit(
        { total: 2300, totalExGst: 2000 },
        { total: 1150, totalExGst: 1000 },
      ),
    ).toEqual({ profit: 1150, profitExGst: 1000 });
  });

  it("goes negative when an event costs more than it took", () => {
    expect(
      eventProfit(
        { total: 100, totalExGst: 100 },
        { total: 230.1, totalExGst: 200.1 },
      ),
    ).toEqual({ profit: -130.1, profitExGst: -100.1 });
  });
});

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
      {
        source: "INVOICE",
        category: "INVOICE",
        amount: 2300,
        gstIncluded: true,
      },
      { source: "CASH", category: "KOHA", amount: 0.2, gstIncluded: false },
    ]);
    expect(summary.total).toBe(5080.3);
    expect(summary.gst).toBe(480); // 150 + 30 + 300
    expect(summary.totalExGst).toBe(4600.3);
    expect(summary.byCategory).toEqual({
      KOHA: 0.2,
      SALES: 1380,
      INVOICE: 2300,
      AUCTION: 900.1,
      DONATION: 500,
      OTHER: 0,
    });
    expect(summary.bySource).toEqual({
      CASH: 230.2,
      EFTPOS: 2050.1,
      STRIPE: 0,
      INVOICE: 2800,
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

describe("describeActivities", () => {
  it("counts each kind in words, catering first", () => {
    expect(describeActivities([])).toBe("");
    expect(describeActivities(["EVENT"])).toBe("an event");
    expect(describeActivities(["CATERING", "CATERING", "CATERING"])).toBe(
      "3 catering gigs"
    );
    expect(describeActivities(["EVENT", "CATERING", "CATERING"])).toBe(
      "2 catering gigs and an event"
    );
  });
});

describe("peopleServed", () => {
  it("adds every event's and catering gig's guests to the day's own count", () => {
    expect(
      peopleServed({
        mealsServed: 60,
        activities: [{ pax: 120 }, { pax: null }, { pax: 40 }],
      })
    ).toBe(220);
    expect(peopleServed({ mealsServed: null, activities: [] })).toBe(0);
  });
});
