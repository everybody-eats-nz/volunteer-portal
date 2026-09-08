import { describe, it, expect } from "vitest";
import {
  explainImplausible,
  hoursBetween,
  isImplausible,
  MAX_PLAUSIBLE_KM,
  MAX_SHORT_TRIP_KM,
} from "./plausibility";

/**
 * This rule is shared by the warning the driver sees and the exception the
 * office sees, so these tests are as much about the two agreeing as about the
 * thresholds themselves.
 */
describe("isImplausible", () => {
  it("passes an ordinary food rescue run", () => {
    expect(isImplausible(24, 1.5)).toBe(false);
  });

  it("catches a distance no van could cover, however long it was out", () => {
    expect(isImplausible(MAX_PLAUSIBLE_KM + 1, 100)).toBe(true);
  });

  it("catches a mistyped digit as an impossible average speed", () => {
    // 512 km in two hours is 256 km/h.
    expect(isImplausible(512, 2)).toBe(true);
  });

  it("judges a trip under half an hour on distance alone", () => {
    // 55 km in six minutes is 550 km/h, but the clock says more about when the
    // driver opened the trip than about the van, so distance decides.
    expect(isImplausible(MAX_SHORT_TRIP_KM - 1, 0.1)).toBe(false);
    expect(isImplausible(MAX_SHORT_TRIP_KM + 1, 0.1)).toBe(true);
  });

  it("allows a genuine open-road run at motorway speed", () => {
    expect(isImplausible(180, 2)).toBe(false);
  });

  it("does not flag a zero-distance trip (a separate rule owns that)", () => {
    expect(isImplausible(0, 1)).toBe(false);
  });
});

describe("explainImplausible", () => {
  it("quotes the average speed when the trip was long enough for it to mean something", () => {
    expect(explainImplausible(512, 2)).toContain("256 km/h");
  });

  it("avoids quoting a speed for a very short trip", () => {
    expect(explainImplausible(200, 0.1)).not.toContain("km/h");
  });
});

describe("hoursBetween", () => {
  it("measures elapsed hours", () => {
    const from = new Date("2026-09-07T08:00:00Z");
    const to = new Date("2026-09-07T11:30:00Z");
    expect(hoursBetween(from, to)).toBe(3.5);
  });
});
