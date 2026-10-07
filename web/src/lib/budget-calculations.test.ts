import { describe, it, expect } from "vitest";
import {
  budgetStatus,
  budgetYearLabel,
  budgetYearOf,
  budgetYearRange,
  budgetYearSpan,
  currentBudgetYear,
  computeBudgetProgress,
  makeNightlyTargetLookup,
  resolveNightlyTarget,
  nightlyTargetFor,
  ratioToPercent,
  yearElapsedRatio,
} from "./budget-calculations";

// 200 planned nights at $500 a night
const BUDGET = { annualTarget: 100_000, plannedServiceNights: 200 };

describe("nightlyTargetFor", () => {
  it("spreads the annual target over the planned nights", () => {
    expect(nightlyTargetFor(BUDGET)).toBe(500);
  });

  it("has no nightly target without planned nights", () => {
    expect(
      nightlyTargetFor({ annualTarget: 100_000, plannedServiceNights: 0 })
    ).toBeNull();
  });
});

describe("budgetStatus", () => {
  it("is green at or above target", () => {
    expect(budgetStatus(500, 500)).toBe("green");
    expect(budgetStatus(800, 500)).toBe("green");
  });

  it("is yellow from 90% up to just under target", () => {
    expect(budgetStatus(450, 500)).toBe("yellow");
    expect(budgetStatus(499.99, 500)).toBe("yellow");
  });

  it("is red below 90%", () => {
    expect(budgetStatus(449.99, 500)).toBe("red");
    expect(budgetStatus(0, 500)).toBe("red");
  });
});

describe("ratioToPercent", () => {
  it("rounds down so the number agrees with the colour", () => {
    expect(ratioToPercent(0.8999)).toBe(89);
    expect(ratioToPercent(0.9)).toBe(90);
    expect(ratioToPercent(0.9999)).toBe(99);
    expect(ratioToPercent(1)).toBe(100);
    // Floating point: 0.29 * 100 = 28.999999999999996
    expect(ratioToPercent(0.29)).toBe(29);
  });
});

describe("computeBudgetProgress", () => {
  it("tracks year to date against the pro-rata target", () => {
    const p = computeBudgetProgress(BUDGET, [600, 450, 300]);
    expect(p.nightlyTarget).toBe(500);
    expect(p.nightsHeld).toBe(3);
    expect(p.ytdActual).toBe(1350);
    expect(p.ytdTarget).toBe(1500);
    expect(p.ytdVariance).toBe(-150);
    expect(p.ytdRatio).toBeCloseTo(0.9);
    expect(p.ytdStatus).toBe("yellow");
    expect(p.annualRatio).toBeCloseTo(0.0135);
    expect(p.statusCounts).toEqual({ green: 1, yellow: 1, red: 1 });
  });

  it("works out the average needed per remaining planned night", () => {
    const p = computeBudgetProgress(BUDGET, [600, 450, 300]);
    expect(p.remainingNights).toBe(197);
    expect(p.remainingTarget).toBe(98_650);
    expect(p.avgNeededPerRemaining).toBeCloseTo(98_650 / 197);
  });

  it("projects the year end from the average so far", () => {
    const p = computeBudgetProgress(BUDGET, [400, 400]);
    expect(p.avgActualPerNight).toBe(400);
    expect(p.projectedYearEnd).toBe(400 * 200);
  });

  it("needs the plain nightly target before any nights are held", () => {
    const p = computeBudgetProgress(BUDGET, []);
    expect(p.nightsHeld).toBe(0);
    expect(p.ytdRatio).toBeNull();
    expect(p.ytdStatus).toBeNull();
    expect(p.avgActualPerNight).toBeNull();
    expect(p.avgNeededPerRemaining).toBe(500);
    expect(p.projectedYearEnd).toBe(0);
  });

  it("needs nothing more once the target is already met", () => {
    const p = computeBudgetProgress(
      { annualTarget: 1000, plannedServiceNights: 10 },
      [600, 500]
    );
    expect(p.budgetMet).toBe(true);
    expect(p.remainingTarget).toBe(0);
    expect(p.remainingNights).toBe(8);
    expect(p.avgNeededPerRemaining).toBe(0);
  });

  it("cannot reach budget when no planned nights remain", () => {
    const p = computeBudgetProgress(
      { annualTarget: 1000, plannedServiceNights: 2 },
      [300, 300]
    );
    expect(p.budgetMet).toBe(false);
    expect(p.remainingNights).toBe(0);
    expect(p.remainingTarget).toBe(400);
    expect(p.avgNeededPerRemaining).toBeNull();
  });

  it("treats holding more nights than planned as no nights remaining", () => {
    const p = computeBudgetProgress(
      { annualTarget: 1000, plannedServiceNights: 2 },
      [100, 100, 100]
    );
    expect(p.remainingNights).toBe(0);
    expect(p.avgNeededPerRemaining).toBeNull();
    expect(p.projectedYearEnd).toBe(300);
  });

  it("reports met with no nights remaining as needing nothing", () => {
    const p = computeBudgetProgress(
      { annualTarget: 1000, plannedServiceNights: 2 },
      [500, 500]
    );
    expect(p.budgetMet).toBe(true);
    expect(p.avgNeededPerRemaining).toBe(0);
  });
});

describe("budget years", () => {
  it("span the NZ financial year, 1 April to 31 March", () => {
    const { start, end } = budgetYearRange(2027);
    // NZ midnight 1 Apr is 11:00 UTC on 31 Mar (NZDT, UTC+13)
    expect(start.toISOString()).toBe("2026-03-31T11:00:00.000Z");
    expect(end.toISOString()).toBe("2027-03-31T11:00:00.000Z");
  });

  it("are numbered by the March they end in", () => {
    // NZ 31 Mar 2026 closes budget year 2026
    expect(budgetYearOf(new Date("2026-03-30T11:00:00Z"))).toBe(2026);
    // NZ 1 Apr 2026 opens budget year 2027
    expect(budgetYearOf(new Date("2026-03-31T11:00:00Z"))).toBe(2027);
    // NZ 1 Jan 2027 is still budget year 2027
    expect(budgetYearOf(new Date("2026-12-31T11:00:00Z"))).toBe(2027);
  });

  it("assign a night to its NZ date, not its UTC date", () => {
    // 10:30 UTC on 31 Mar 2026 is already 1 Apr in NZ
    expect(budgetYearOf(new Date("2026-03-31T10:30:00Z"))).toBe(2026);
    expect(budgetYearOf(new Date("2026-03-31T11:30:00Z"))).toBe(2027);
  });

  it("know which year is in progress", () => {
    expect(currentBudgetYear(new Date("2026-10-07T00:00:00Z"))).toBe(2027);
    expect(currentBudgetYear(new Date("2026-02-07T00:00:00Z"))).toBe(2026);
  });

  it("label a year by both calendar years it spans", () => {
    expect(budgetYearLabel(2027)).toBe("2026/27");
    expect(budgetYearLabel(2100)).toBe("2099/00");
    expect(budgetYearSpan(2027)).toBe("1 Apr 2026 – 31 Mar 2027");
  });

  it("measure how much of the year has elapsed", () => {
    const { start, end } = budgetYearRange(2027);
    expect(yearElapsedRatio(2027, start)).toBe(0);
    expect(yearElapsedRatio(2027, end)).toBe(1);
    expect(yearElapsedRatio(2027, new Date("2024-06-01T00:00:00Z"))).toBe(0);
    expect(yearElapsedRatio(2027, new Date("2028-06-01T00:00:00Z"))).toBe(1);
    const mid = yearElapsedRatio(2027, new Date("2026-09-30T12:00:00Z"));
    expect(mid).toBeGreaterThan(0.49);
    expect(mid).toBeLessThan(0.51);
  });
});

describe("makeNightlyTargetLookup", () => {
  const lookup = makeNightlyTargetLookup([
    {
      name: "Wellington",
      targetPerNight: 700,
      budgets: [{ year: 2026, annualTarget: 120_000, plannedServiceNights: 240 }],
    },
    { name: "Onehunga", targetPerNight: null, budgets: [] },
  ]);

  it("uses the budget's nightly target in a budgeted year", () => {
    // NZ 11 Mar 2026 is in budget year 2026 (Apr 2025 - Mar 2026)
    expect(lookup("Wellington", new Date("2026-03-10T11:00:00Z"))).toBe(500);
    expect(lookup("Wellington", new Date("2025-04-10T11:00:00Z"))).toBe(500);
  });

  it("falls back to the standing per-night target in other years", () => {
    // NZ 11 Apr 2026 starts budget year 2027, which has no budget
    expect(lookup("Wellington", new Date("2026-04-10T11:00:00Z"))).toBe(700);
    expect(lookup("Wellington", new Date("2025-03-10T11:00:00Z"))).toBe(700);
  });

  it("has no target for a location without one", () => {
    expect(lookup("Onehunga", new Date("2026-03-10T11:00:00Z"))).toBeNull();
    expect(lookup("Unknown", new Date("2026-03-10T11:00:00Z"))).toBeNull();
  });
});

describe("resolveNightlyTarget", () => {
  const wellington = {
    targetPerNight: 700,
    budgets: [{ year: 2027, annualTarget: 120_000, plannedServiceNights: 240 }],
  };

  it("says the target came from the night's budget", () => {
    // NZ 7 Oct 2026 is in budget year 2027 (Apr 2026 - Mar 2027)
    expect(
      resolveNightlyTarget(wellington, new Date("2026-10-06T11:00:00Z"))
    ).toEqual({ amount: 500, source: "budget", budgetYear: 2027 });
  });

  it("falls back to the venue's standing target outside budgeted years", () => {
    expect(
      resolveNightlyTarget(wellington, new Date("2026-03-10T11:00:00Z"))
    ).toEqual({ amount: 700, source: "venue", budgetYear: 2026 });
  });

  it("has no target when the budget has no planned nights", () => {
    expect(
      resolveNightlyTarget(
        {
          targetPerNight: 700,
          budgets: [{ year: 2027, annualTarget: 120_000, plannedServiceNights: 0 }],
        },
        new Date("2026-10-06T11:00:00Z")
      )
    ).toBeNull();
  });

  it("has no target when the venue has neither", () => {
    expect(
      resolveNightlyTarget(
        { targetPerNight: null, budgets: [] },
        new Date("2026-10-06T11:00:00Z")
      )
    ).toBeNull();
  });
});
