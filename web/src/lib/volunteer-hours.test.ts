import { describe, it, expect } from "vitest";
import { displayHours, totalShiftHours } from "./volunteer-hours";

function shift(start: string, end: string) {
  return { start: new Date(start), end: new Date(end) };
}

describe("totalShiftHours", () => {
  it("counts partial hours instead of truncating each shift", () => {
    const shifts = [
      shift("2026-10-01T05:00:00Z", "2026-10-01T07:30:00Z"), // 2.5h
      shift("2026-10-02T05:00:00Z", "2026-10-02T07:30:00Z"), // 2.5h
      shift("2026-10-03T05:00:00Z", "2026-10-03T06:45:00Z"), // 1.75h
    ];

    expect(totalShiftHours(shifts)).toBe(6.75);
  });

  it("keeps whole-hour totals exact when shifts are thirds of an hour", () => {
    // 20/60 summed per shift in floating point would land at 0.999...
    const shifts = [
      shift("2026-10-01T05:00:00Z", "2026-10-01T05:20:00Z"),
      shift("2026-10-02T05:00:00Z", "2026-10-02T05:20:00Z"),
      shift("2026-10-03T05:00:00Z", "2026-10-03T05:20:00Z"),
    ];

    expect(totalShiftHours(shifts)).toBe(1);
  });

  it("returns 0 with no shifts", () => {
    expect(totalShiftHours([])).toBe(0);
  });
});

describe("displayHours", () => {
  it("rounds down so the total never reads past an unmet hours target", () => {
    expect(displayHours(49.75)).toBe(49);
    expect(displayHours(50)).toBe(50);
    expect(displayHours(0)).toBe(0);
  });
});
