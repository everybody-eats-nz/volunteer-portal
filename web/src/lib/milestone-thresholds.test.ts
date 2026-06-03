import { describe, it, expect } from "vitest";
import {
  getMilestoneStatus,
  MILESTONE_THRESHOLDS,
} from "./milestone-thresholds";

describe("getMilestoneStatus", () => {
  it("flags the shift that lands exactly on a milestone (hitsOnNext)", () => {
    expect(getMilestoneStatus(9)).toEqual({
      nextThreshold: 10,
      shiftsAway: 1,
      hitsOnNext: true,
    });
    expect(getMilestoneStatus(24)).toEqual({
      nextThreshold: 25,
      shiftsAway: 1,
      hitsOnNext: true,
    });
    expect(getMilestoneStatus(49)).toEqual({
      nextThreshold: 50,
      shiftsAway: 1,
      hitsOnNext: true,
    });
  });

  it("reports approaching volunteers (more than one shift away)", () => {
    expect(getMilestoneStatus(23)).toEqual({
      nextThreshold: 25,
      shiftsAway: 2,
      hitsOnNext: false,
    });
    expect(getMilestoneStatus(0)).toEqual({
      nextThreshold: 10,
      shiftsAway: 10,
      hitsOnNext: false,
    });
  });

  it("advances to the next threshold once one is reached", () => {
    expect(getMilestoneStatus(10)).toEqual({
      nextThreshold: 25,
      shiftsAway: 15,
      hitsOnNext: false,
    });
    expect(getMilestoneStatus(25)).toEqual({
      nextThreshold: 50,
      shiftsAway: 25,
      hitsOnNext: false,
    });
  });

  it("returns no next threshold past the top milestone", () => {
    expect(getMilestoneStatus(500)).toEqual({
      nextThreshold: null,
      shiftsAway: 0,
      hitsOnNext: false,
    });
    expect(getMilestoneStatus(999)).toEqual({
      nextThreshold: null,
      shiftsAway: 0,
      hitsOnNext: false,
    });
    // One away from the top milestone still flags.
    expect(getMilestoneStatus(499)).toEqual({
      nextThreshold: 500,
      shiftsAway: 1,
      hitsOnNext: true,
    });
  });

  it("handles invalid/negative/fractional input defensively", () => {
    expect(getMilestoneStatus(-5)).toEqual({
      nextThreshold: 10,
      shiftsAway: 10,
      hitsOnNext: false,
    });
    expect(getMilestoneStatus(9.7)).toEqual({
      nextThreshold: 10,
      shiftsAway: 1,
      hitsOnNext: true,
    });
    expect(getMilestoneStatus(NaN)).toEqual({
      nextThreshold: 10,
      shiftsAway: 10,
      hitsOnNext: false,
    });
  });

  it("exposes the canonical thresholds", () => {
    expect(MILESTONE_THRESHOLDS).toEqual([10, 25, 50, 100, 200, 500]);
  });
});
