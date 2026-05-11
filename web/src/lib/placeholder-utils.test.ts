import { describe, it, expect } from "vitest";
import {
  getEffectiveConfirmedCount,
  getShiftConfirmedCount,
  getShiftEffectiveCount,
  shiftCapacityCountSelect,
} from "./placeholder-utils";

describe("getEffectiveConfirmedCount", () => {
  it("should add confirmed signups and placeholder count", () => {
    expect(getEffectiveConfirmedCount(3, 2)).toBe(5);
  });

  it("should return just confirmed signups when placeholders are 0", () => {
    expect(getEffectiveConfirmedCount(4, 0)).toBe(4);
  });

  it("should clamp negative placeholder count to 0", () => {
    expect(getEffectiveConfirmedCount(3, -5)).toBe(3);
  });

  it("should handle zero for both values", () => {
    expect(getEffectiveConfirmedCount(0, 0)).toBe(0);
  });

  it("should handle large values", () => {
    expect(getEffectiveConfirmedCount(100, 50)).toBe(150);
  });
});

describe("getShiftConfirmedCount", () => {
  it("counts CONFIRMED signups plus unregistered placeholders", () => {
    expect(
      getShiftConfirmedCount({
        signups: [
          { status: "CONFIRMED" },
          { status: "CONFIRMED" },
          { status: "PENDING" },
          { status: "CANCELED" },
          { status: "WAITLISTED" },
        ],
        _count: { placeholders: 3 },
      })
    ).toBe(5);
  });

  it("ignores non-CONFIRMED signup statuses", () => {
    expect(
      getShiftConfirmedCount({
        signups: [
          { status: "PENDING" },
          { status: "WAITLISTED" },
          { status: "NO_SHOW" },
          { status: "CANCELED" },
          { status: "REGULAR_PENDING" },
        ],
        _count: { placeholders: 2 },
      })
    ).toBe(2);
  });

  it("returns 0 when there are no signups or placeholders", () => {
    expect(
      getShiftConfirmedCount({ signups: [], _count: { placeholders: 0 } })
    ).toBe(0);
  });
});

describe("getShiftEffectiveCount", () => {
  it("sums _count.signups and _count.placeholders", () => {
    expect(
      getShiftEffectiveCount({ _count: { signups: 4, placeholders: 2 } })
    ).toBe(6);
  });

  it("returns just signups when placeholders are 0", () => {
    expect(
      getShiftEffectiveCount({ _count: { signups: 3, placeholders: 0 } })
    ).toBe(3);
  });

  it("returns just placeholders when signups are 0", () => {
    expect(
      getShiftEffectiveCount({ _count: { signups: 0, placeholders: 5 } })
    ).toBe(5);
  });

  it("returns 0 when both are 0", () => {
    expect(
      getShiftEffectiveCount({ _count: { signups: 0, placeholders: 0 } })
    ).toBe(0);
  });
});

describe("shiftCapacityCountSelect", () => {
  it("filters signups by the provided statuses and always counts placeholders", () => {
    expect(shiftCapacityCountSelect(["CONFIRMED"])).toEqual({
      select: {
        signups: { where: { status: { in: ["CONFIRMED"] } } },
        placeholders: true,
      },
    });
  });

  it("supports multiple statuses", () => {
    expect(shiftCapacityCountSelect(["CONFIRMED", "REGULAR_PENDING"])).toEqual({
      select: {
        signups: {
          where: { status: { in: ["CONFIRMED", "REGULAR_PENDING"] } },
        },
        placeholders: true,
      },
    });
  });

  it("counts all signups (unfiltered) when no statuses are provided", () => {
    expect(shiftCapacityCountSelect()).toEqual({
      select: { signups: true, placeholders: true },
    });
  });
});
