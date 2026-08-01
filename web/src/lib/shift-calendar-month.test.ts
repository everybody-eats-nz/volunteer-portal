import { describe, it, expect } from "vitest";
import { resolveInitialCalendarMonth } from "./shift-calendar-month";

describe("resolveInitialCalendarMonth", () => {
  it("opens on the current month when it still has shifts", () => {
    const now = new Date(2026, 6, 15, 9, 0); // Wed 15 Jul 2026

    expect(
      resolveInitialCalendarMonth(
        [new Date(2026, 6, 19, 17, 30), new Date(2026, 7, 2, 17, 30)],
        now
      )
    ).toBe("2026-07");
  });

  it("skips to the next month with shifts when the current one has none left", () => {
    // Fri 31 Jul 2026: the restaurant is closed Fri/Sat, so the next shift is
    // Sun 2 Aug and July has nothing left to show.
    const now = new Date(2026, 6, 31, 21, 0);

    expect(
      resolveInitialCalendarMonth(
        [new Date(2026, 7, 2, 17, 30), new Date(2026, 7, 3, 17, 30)],
        now
      )
    ).toBe("2026-08");
  });

  it("picks the earliest shift regardless of input order", () => {
    const now = new Date(2026, 6, 31, 21, 0);

    expect(
      resolveInitialCalendarMonth(
        [new Date(2026, 8, 1, 17, 30), new Date(2026, 7, 2, 17, 30)],
        now
      )
    ).toBe("2026-08");
  });

  it("crosses a year boundary", () => {
    const now = new Date(2026, 11, 31, 21, 0); // Thu 31 Dec 2026

    expect(
      resolveInitialCalendarMonth([new Date(2027, 0, 3, 17, 30)], now)
    ).toBe("2027-01");
  });

  it("falls back to the current month when there are no shifts at all", () => {
    const now = new Date(2026, 6, 31, 21, 0);

    expect(resolveInitialCalendarMonth([], now)).toBe("2026-07");
  });

  it("stays on the current month when a shift is later the same day", () => {
    const now = new Date(2026, 6, 30, 16, 0); // Thu 30 Jul, before service

    expect(
      resolveInitialCalendarMonth([new Date(2026, 6, 30, 17, 30)], now)
    ).toBe("2026-07");
  });
});
