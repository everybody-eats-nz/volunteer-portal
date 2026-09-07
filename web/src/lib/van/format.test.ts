import { describe, it, expect } from "vitest";
import { formatDuration, formatKm, formatOdo } from "./format";

describe("formatDuration", () => {
  const from = new Date("2026-09-07T08:00:00Z");
  const plus = (mins: number) => new Date(from.getTime() + mins * 60_000);

  it("says 'under a minute' rather than '0m'", () => {
    // The end-of-trip warning renders "<distance> in <duration>", and "512 km
    // in 0m" reads as a broken clock rather than a questionable reading.
    expect(formatDuration(from, plus(0))).toBe("under a minute");
    expect(formatDuration(from, from)).toBe("under a minute");
  });

  it("renders minutes, hours and days", () => {
    expect(formatDuration(from, plus(45))).toBe("45m");
    expect(formatDuration(from, plus(135))).toBe("2h 15m");
    expect(formatDuration(from, plus(60 * 30))).toBe("1d 6h");
  });

  it("never goes negative when the clocks disagree", () => {
    expect(formatDuration(from, plus(-30))).toBe("under a minute");
  });
});

describe("formatOdo and formatKm", () => {
  it("groups thousands the way a NZ dashboard reads", () => {
    expect(formatOdo(150245)).toBe("150,245");
    expect(formatKm(512)).toBe("512 km");
  });

  it("rounds to whole kilometres", () => {
    expect(formatOdo(150245.6)).toBe("150,246");
  });
});
