import { describe, it, expect } from "vitest";
import {
  computeCoverageTotals,
  fillRate,
  type ShiftCoverageRow,
} from "./shift-coverage";

function row(overrides: Partial<ShiftCoverageRow>): ShiftCoverageRow {
  return {
    location: "Wellington",
    totalShifts: 0,
    totalPositions: 0,
    filledPositions: 0,
    unfilledShifts: 0,
    fullyEmptyShifts: 0,
    understaffedShifts: 0,
    criticallyUnderstaffedShifts: 0,
    fillRate: 0,
    ...overrides,
  };
}

describe("fillRate", () => {
  it("computes a rounded percentage", () => {
    expect(fillRate(75, 100)).toBe(75);
    expect(fillRate(1, 3)).toBe(33);
    expect(fillRate(2, 3)).toBe(67);
  });

  it("returns 0 when no positions are offered (no divide-by-zero)", () => {
    expect(fillRate(0, 0)).toBe(0);
    expect(fillRate(5, 0)).toBe(0);
  });
});

describe("computeCoverageTotals", () => {
  it("returns an empty total for no rows", () => {
    expect(computeCoverageTotals([])).toEqual({
      location: "All Locations",
      totalShifts: 0,
      totalPositions: 0,
      filledPositions: 0,
      unfilledShifts: 0,
      fullyEmptyShifts: 0,
      understaffedShifts: 0,
      criticallyUnderstaffedShifts: 0,
      fillRate: 0,
    });
  });

  it("sums every metric across restaurants and recomputes the fill rate", () => {
    const totals = computeCoverageTotals([
      row({
        location: "Wellington",
        totalShifts: 10,
        totalPositions: 40,
        filledPositions: 30,
        unfilledShifts: 4,
        fullyEmptyShifts: 1,
        understaffedShifts: 3,
        criticallyUnderstaffedShifts: 1,
      }),
      row({
        location: "Auckland",
        totalShifts: 6,
        totalPositions: 20,
        filledPositions: 10,
        unfilledShifts: 5,
        fullyEmptyShifts: 2,
        understaffedShifts: 4,
        criticallyUnderstaffedShifts: 2,
      }),
    ]);

    expect(totals.totalShifts).toBe(16);
    expect(totals.totalPositions).toBe(60);
    expect(totals.filledPositions).toBe(40);
    expect(totals.unfilledShifts).toBe(9);
    expect(totals.fullyEmptyShifts).toBe(3);
    expect(totals.understaffedShifts).toBe(7);
    expect(totals.criticallyUnderstaffedShifts).toBe(3);
    // 40 / 60 = 66.7% → 67
    expect(totals.fillRate).toBe(67);
  });

  it("keeps critically understaffed as a subset of understaffed in the totals", () => {
    const totals = computeCoverageTotals([
      row({ understaffedShifts: 3, criticallyUnderstaffedShifts: 1 }),
      row({ understaffedShifts: 2, criticallyUnderstaffedShifts: 2 }),
    ]);
    expect(totals.criticallyUnderstaffedShifts).toBeLessThanOrEqual(
      totals.understaffedShifts
    );
  });
});
