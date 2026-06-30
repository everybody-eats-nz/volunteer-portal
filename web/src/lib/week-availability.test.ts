import { describe, it, expect } from "vitest";
import { getWeekAvailability } from "./week-availability";

const order = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

describe("getWeekAvailability", () => {
  it("always returns all seven days in Monday-first order", () => {
    const { days } = getWeekAvailability([]);
    expect(days.map((d) => d.key)).toEqual(order);
  });

  it("returns an empty count and no available days for empty input", () => {
    const { days, count } = getWeekAvailability([]);
    expect(count).toBe(0);
    expect(days.every((d) => !d.isAvailable)).toBe(true);
  });

  it("flags available days and counts them", () => {
    const { days, count } = getWeekAvailability(["monday", "wednesday", "friday"]);
    expect(count).toBe(3);
    expect(days.filter((d) => d.isAvailable).map((d) => d.key)).toEqual([
      "monday",
      "wednesday",
      "friday",
    ]);
  });

  it("orders out-of-order, capitalised input Monday-first", () => {
    const { days, count } = getWeekAvailability(["Saturday", "Wednesday", "Monday"]);
    expect(count).toBe(3);
    expect(days.filter((d) => d.isAvailable).map((d) => d.key)).toEqual([
      "monday",
      "wednesday",
      "saturday",
    ]);
  });

  it("matches case-insensitively and trims whitespace", () => {
    const { count, days } = getWeekAvailability([" Monday ", "TUESDAY", "wEdNeSdAy"]);
    expect(count).toBe(3);
    expect(days.filter((d) => d.isAvailable).map((d) => d.key)).toEqual([
      "monday",
      "tuesday",
      "wednesday",
    ]);
  });

  it("handles a full week", () => {
    const { count } = getWeekAvailability(order);
    expect(count).toBe(7);
  });

  it("ignores unknown day values", () => {
    const { count } = getWeekAvailability(["someday", "monday"]);
    expect(count).toBe(1);
  });

  it("treats null/undefined as no availability", () => {
    expect(getWeekAvailability(null).count).toBe(0);
    expect(getWeekAvailability(undefined).count).toBe(0);
  });
});
