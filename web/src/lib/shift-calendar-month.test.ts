import { describe, it, expect } from "vitest";
import { resolveInitialCalendarMonth } from "./shift-calendar-month";

// Every case here turns on which month a date falls in, so the bare JS month
// indices get names - `new Date(2026, 6, 31)` being July is exactly the kind of
// off-by-one this suite exists to catch.
const JAN = 0;
const JUL = 6;
const AUG = 7;
const SEP = 8;
const DEC = 11;

describe("resolveInitialCalendarMonth", () => {
  it("opens on the current month when it still has shifts", () => {
    const now = new Date(2026, JUL, 15, 9, 0); // Wed 15 Jul 2026

    expect(
      resolveInitialCalendarMonth(
        [new Date(2026, JUL, 19, 17, 30), new Date(2026, AUG, 2, 17, 30)],
        now
      )
    ).toBe("2026-07");
  });

  it("skips to the next month with shifts when the current one has none left", () => {
    // Fri 31 Jul 2026: the restaurant is closed Fri/Sat, so the next shift is
    // Sun 2 Aug and July has nothing left to show.
    const now = new Date(2026, JUL, 31, 21, 0);

    expect(
      resolveInitialCalendarMonth(
        [new Date(2026, AUG, 2, 17, 30), new Date(2026, AUG, 3, 17, 30)],
        now
      )
    ).toBe("2026-08");
  });

  it("picks the earliest shift regardless of input order", () => {
    const now = new Date(2026, JUL, 31, 21, 0);

    expect(
      resolveInitialCalendarMonth(
        [new Date(2026, SEP, 1, 17, 30), new Date(2026, AUG, 2, 17, 30)],
        now
      )
    ).toBe("2026-08");
  });

  it("crosses a year boundary", () => {
    const now = new Date(2026, DEC, 31, 21, 0); // Thu 31 Dec 2026

    expect(
      resolveInitialCalendarMonth([new Date(2027, JAN, 3, 17, 30)], now)
    ).toBe("2027-01");
  });

  it("falls back to the current month when there are no shifts at all", () => {
    const now = new Date(2026, JUL, 31, 21, 0);

    expect(resolveInitialCalendarMonth([], now)).toBe("2026-07");
  });

  it("stays on the current month when a shift is later the same day", () => {
    const now = new Date(2026, JUL, 30, 16, 0); // Thu 30 Jul, before service

    expect(
      resolveInitialCalendarMonth([new Date(2026, JUL, 30, 17, 30)], now)
    ).toBe("2026-07");
  });
});
