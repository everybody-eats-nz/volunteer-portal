import { describe, it, expect } from "vitest";
import { getEffectiveConfirmedCount } from "./placeholder-utils";

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
