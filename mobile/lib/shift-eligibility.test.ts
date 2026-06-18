import { describe, expect, it } from "vitest";

import {
  findConflictingShift,
  getShiftDayKey,
  getShiftPeriod,
  getShiftPeriodKey,
  getShiftPeriodLabel,
} from "@/lib/shift-eligibility";
import type { Shift } from "@/lib/dummy-data";

// NZ is UTC+12 in June (NZST). Times below are the UTC instant with the
// equivalent NZ local time noted, so the 4pm Day/Evening cutoff is explicit.
const NZ_1300 = "2026-06-18T01:00:00.000Z"; // NZ 13:00 → Day
const NZ_1500 = "2026-06-18T03:00:00.000Z"; // NZ 15:00 → Day
const NZ_1600 = "2026-06-18T04:00:00.000Z"; // NZ 16:00 → Evening (cutoff)
const NZ_1800 = "2026-06-18T06:00:00.000Z"; // NZ 18:00 → Evening

function makeShift(over: Partial<Shift> & { id: string; start: string }): Shift {
  return {
    shiftType: { id: "st", name: "Kitchen", description: "" },
    end: over.start,
    location: "Wellington",
    capacity: 5,
    signedUp: 0,
    status: "CONFIRMED",
    ...over,
  };
}

describe("getShiftDayKey", () => {
  it("returns the NZ calendar day", () => {
    expect(getShiftDayKey(NZ_1500)).toBe("2026-06-18");
  });

  it("uses the NZ day even when the UTC day differs", () => {
    // NZ 10:00 on Jun 18 is still Jun 17 in UTC.
    expect(getShiftDayKey("2026-06-17T22:00:00.000Z")).toBe("2026-06-18");
  });
});

describe("getShiftPeriod", () => {
  it("treats before 4pm NZ as Day", () => {
    expect(getShiftPeriod(NZ_1300)).toBe("DAY");
    expect(getShiftPeriod(NZ_1500)).toBe("DAY");
  });

  it("treats 4pm NZ and later as Evening (cutoff is exclusive)", () => {
    expect(getShiftPeriod(NZ_1600)).toBe("EVENING");
    expect(getShiftPeriod(NZ_1800)).toBe("EVENING");
  });

  it("is independent of the device timezone", () => {
    const originalTZ = process.env.TZ;
    try {
      for (const tz of ["America/Los_Angeles", "UTC", "Pacific/Kiritimati"]) {
        process.env.TZ = tz;
        expect(getShiftPeriod(NZ_1500)).toBe("DAY");
        expect(getShiftPeriod(NZ_1600)).toBe("EVENING");
      }
    } finally {
      process.env.TZ = originalTZ;
    }
  });
});

describe("getShiftPeriodLabel / getShiftPeriodKey", () => {
  it("labels the period in lowercase", () => {
    expect(getShiftPeriodLabel(NZ_1500)).toBe("day");
    expect(getShiftPeriodLabel(NZ_1600)).toBe("evening");
  });

  it("combines day + period into a stable key", () => {
    expect(getShiftPeriodKey(NZ_1500)).toBe("2026-06-18|DAY");
    expect(getShiftPeriodKey(NZ_1600)).toBe("2026-06-18|EVENING");
  });
});

describe("findConflictingShift", () => {
  const target = { id: "target", start: NZ_1500 }; // Day shift

  it("returns null when the volunteer holds no shifts", () => {
    expect(findConflictingShift(target, [])).toBeNull();
  });

  it("detects another booked shift in the same day + period", () => {
    const mine = makeShift({ id: "a", start: NZ_1300, status: "CONFIRMED" });
    expect(findConflictingShift(target, [mine])).toBe(mine);
  });

  it("counts PENDING signups as conflicts", () => {
    const mine = makeShift({ id: "a", start: NZ_1300, status: "PENDING" });
    expect(findConflictingShift(target, [mine])).toBe(mine);
  });

  it("does not clash across periods (one Day + one Evening allowed)", () => {
    const evening = makeShift({ id: "a", start: NZ_1800, status: "CONFIRMED" });
    expect(findConflictingShift(target, [evening])).toBeNull();
  });

  it("ignores WAITLISTED and REGULAR_PENDING signups", () => {
    const waitlisted = makeShift({ id: "a", start: NZ_1300, status: "WAITLISTED" });
    const regular = makeShift({ id: "b", start: NZ_1300, status: "REGULAR_PENDING" });
    expect(findConflictingShift(target, [waitlisted, regular])).toBeNull();
  });

  it("does not flag the target shift against itself", () => {
    const self = makeShift({ id: "target", start: NZ_1500, status: "CONFIRMED" });
    expect(findConflictingShift(target, [self])).toBeNull();
  });

  it("does not clash on a different calendar day", () => {
    const otherDay = makeShift({
      id: "a",
      start: "2026-06-19T03:00:00.000Z",
      status: "CONFIRMED",
    });
    expect(findConflictingShift(target, [otherDay])).toBeNull();
  });
});
