import { afterEach, describe, expect, it } from "vitest";
import { formatNZDateOnly, formatNZT } from "@/lib/dates";

describe("formatNZDateOnly", () => {
  const originalTZ = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTZ;
  });

  it("formats a plain YYYY-MM-DD date", () => {
    expect(formatNZDateOnly("2026-05-18", "EEEE d MMM")).toBe("Monday 18 May");
    expect(formatNZDateOnly("2026-05-18", "yyyy-MM-dd")).toBe("2026-05-18");
  });

  it("formats a midnight-UTC ISO string by its calendar day", () => {
    expect(formatNZDateOnly("2026-05-18T00:00:00.000Z", "EEEE d MMM")).toBe(
      "Monday 18 May"
    );
    expect(formatNZDateOnly("2026-05-18T00:00:00.000Z", "yyyy-MM-dd")).toBe(
      "2026-05-18"
    );
  });

  it("handles year and month boundaries", () => {
    expect(formatNZDateOnly("2026-01-01", "EEEE d MMM")).toBe("Thursday 1 Jan");
    expect(formatNZDateOnly("2026-12-31", "EEEE d MMM")).toBe("Thursday 31 Dec");
    expect(formatNZDateOnly("2024-02-29", "EEEE d MMM")).toBe("Thursday 29 Feb");
  });

  // The bug this helper exists to prevent: a date-only value transported as a
  // midnight-UTC timestamp must NOT shift to the previous day on devices behind
  // UTC (Android/Hermes silently formats in device-local time). The result must
  // be identical regardless of the runtime timezone.
  it("is timezone-independent (regression: Android shows previous day)", () => {
    for (const tz of [
      "America/Los_Angeles", // UTC-7/8 — the failing case
      "UTC",
      "Pacific/Auckland",
      "Pacific/Kiritimati", // UTC+14
    ]) {
      process.env.TZ = tz;
      expect(formatNZDateOnly("2026-05-18T00:00:00.000Z", "EEEE d MMM")).toBe(
        "Monday 18 May"
      );
      expect(formatNZDateOnly("2026-05-18", "yyyy-MM-dd")).toBe("2026-05-18");
    }
  });

  it("returns an empty string for malformed or out-of-range input", () => {
    expect(formatNZDateOnly("", "yyyy-MM-dd")).toBe("");
    expect(formatNZDateOnly("invalid", "yyyy-MM-dd")).toBe("");
    expect(formatNZDateOnly("2026-13-45", "yyyy-MM-dd")).toBe(""); // month/day out of range
    expect(formatNZDateOnly("2026-00-10", "yyyy-MM-dd")).toBe(""); // month 0
    expect(formatNZDateOnly("2026-05-00", "yyyy-MM-dd")).toBe(""); // day 0
    expect(formatNZDateOnly("2026-05-32", "yyyy-MM-dd")).toBe(""); // day 32
  });
});

describe("formatNZT", () => {
  // Real instants are converted to NZ time. 2026-05-18T00:00:00Z is noon NZ
  // (NZST, UTC+12) the same day; 2026-05-17T18:00:00Z is 6am NZ on the 18th.
  it("converts an instant to the Pacific/Auckland calendar day", () => {
    expect(formatNZT("2026-05-18T00:00:00.000Z", "yyyy-MM-dd")).toBe(
      "2026-05-18"
    );
    expect(formatNZT("2026-05-17T18:00:00.000Z", "yyyy-MM-dd")).toBe(
      "2026-05-18"
    );
  });
});
