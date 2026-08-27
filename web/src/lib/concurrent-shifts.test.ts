import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "./prisma";
import {
  buildOverlapMessage,
  findOverlappingSignup,
} from "./concurrent-shifts";
import { getShiftPeriodLabel, isDayShift, shiftsOverlap } from "./shift-periods";

// Fixtures are written as literal UTC instants rather than being derived with
// the app's own timezone helpers: those helpers are part of what these tests
// exercise, so deriving the inputs from them could hide a bug in both at once.
// `pins the fixtures to the NZ wall-clock times they claim` asserts the
// intended NZ times through Intl, independently of any app code.

/** 3:00-6:00 pm NZ, Sunday 30 Aug 2026 (NZST, UTC+12) — the reported clash. */
const onehungaThreePM = {
  start: new Date("2026-08-30T03:00:00Z"),
  end: new Date("2026-08-30T06:00:00Z"),
};
/** 11:30am-2:30pm NZ the same day — the shift the volunteer was blocked from. */
const toastElevenThirty = {
  start: new Date("2026-08-29T23:30:00Z"),
  end: new Date("2026-08-30T02:30:00Z"),
};

const formatNZ = (d: Date) =>
  new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Pacific/Auckland",
  }).format(d);

it("pins the fixtures to the NZ wall-clock times they claim", () => {
  expect(formatNZ(onehungaThreePM.start)).toBe("2026-08-30 15:00");
  expect(formatNZ(onehungaThreePM.end)).toBe("2026-08-30 18:00");
  expect(formatNZ(toastElevenThirty.start)).toBe("2026-08-30 11:30");
  expect(formatNZ(toastElevenThirty.end)).toBe("2026-08-30 14:30");
});

describe("shiftsOverlap", () => {
  it("allows the reported case: 11:30am-2:30pm alongside a 3pm shift", () => {
    expect(shiftsOverlap(toastElevenThirty, onehungaThreePM)).toBe(false);
    // Both sit before the 4pm boundary, so the old Day/Evening rule blocked
    // this pair even though the times never met.
    expect(isDayShift(toastElevenThirty.start)).toBe(true);
    expect(isDayShift(onehungaThreePM.start)).toBe(true);
  });

  it("treats back-to-back shifts as non-clashing", () => {
    const first = {
      start: new Date("2026-08-30T00:00:00Z"),
      end: new Date("2026-08-30T03:00:00Z"),
    };
    expect(shiftsOverlap(first, onehungaThreePM)).toBe(false);
  });

  it("catches a partial overlap in either direction", () => {
    const straddling = {
      start: new Date("2026-08-30T02:00:00Z"),
      end: new Date("2026-08-30T04:00:00Z"),
    };
    expect(shiftsOverlap(straddling, onehungaThreePM)).toBe(true);
    expect(shiftsOverlap(onehungaThreePM, straddling)).toBe(true);
  });

  it("catches a shift fully contained in another", () => {
    const inner = {
      start: new Date("2026-08-30T04:00:00Z"),
      end: new Date("2026-08-30T05:00:00Z"),
    };
    expect(shiftsOverlap(inner, onehungaThreePM)).toBe(true);
    expect(shiftsOverlap(onehungaThreePM, inner)).toBe(true);
  });

  it("needs no DST handling, unlike the calendar-day rule it replaced", () => {
    // 5 Apr 2026 is the 25-hour NZ day; an 11:30pm shift used to fall outside a
    // 24-hour window built from local midnight.
    const lateOnDstDay = {
      start: new Date("2026-04-05T11:30:00Z"),
      end: new Date("2026-04-05T13:30:00Z"),
    };
    expect(formatNZ(lateOnDstDay.start)).toBe("2026-04-05 23:30");
    expect(shiftsOverlap(lateOnDstDay, lateOnDstDay)).toBe(true);
    expect(
      shiftsOverlap(lateOnDstDay, {
        start: new Date("2026-04-05T13:30:00Z"),
        end: new Date("2026-04-05T15:00:00Z"),
      })
    ).toBe(false);
  });
});

describe("getShiftPeriodLabel", () => {
  // Retained for display grouping (section headings, calendar labels) even
  // though it no longer decides whether a signup is allowed.
  it("treats 3pm as Day and 5pm as Evening — the boundary is 4pm", () => {
    expect(getShiftPeriodLabel(onehungaThreePM.start)).toBe("Day");
    expect(getShiftPeriodLabel(new Date("2026-08-30T05:00:00Z"))).toBe("Evening");
  });
});

const conflict = (
  shift: { start: Date; end: Date },
  status = "CONFIRMED",
  location: string | null = "Onehunga"
) => ({
  status,
  shift: {
    ...shift,
    location,
    shiftType: { name: "Sunday Kitchen Prep (Onehunga)" },
  },
});

describe("buildOverlapMessage", () => {
  it("names the clashing shift with its full time span", () => {
    const message = buildOverlapMessage({
      conflictingSignup: conflict(onehungaThreePM),
    });

    expect(message).toContain(
      "Sunday Kitchen Prep (Onehunga) at Onehunga, 3:00 PM to 6:00 PM on Sunday 30 August"
    );
    expect(message).toContain("overlaps this one");
  });

  it("says several shifts a day are fine, just not at the same time", () => {
    const message = buildOverlapMessage({
      conflictingSignup: conflict(onehungaThreePM),
    });

    expect(message).toContain(
      "You can take more than one shift a day, as long as the times don't clash"
    );
  });

  it("never falls back to AM/PM period wording", () => {
    const message = buildOverlapMessage({
      conflictingSignup: conflict(onehungaThreePM),
    });

    expect(message).not.toMatch(/\bAM shift\b|\bPM shift\b/);
    expect(message).not.toMatch(/day shift|evening shift/i);
  });

  it("calls a pending signup pending rather than confirmed", () => {
    const message = buildOverlapMessage({
      conflictingSignup: conflict(onehungaThreePM, "PENDING"),
    });

    expect(message).toContain("a pending shift");
    expect(message).not.toContain("confirmed");
  });

  it("addresses admins about the volunteer", () => {
    const message = buildOverlapMessage({
      conflictingSignup: conflict(onehungaThreePM),
      subject: "volunteer",
    });

    expect(message).toMatch(/^This volunteer already has a confirmed shift/);
    expect(message).toContain("but not at the same time");
  });

  it("falls back to TBD when the clashing shift has no location", () => {
    const message = buildOverlapMessage({
      conflictingSignup: conflict(onehungaThreePM, "CONFIRMED", null),
    });

    expect(message).toContain("at TBD,");
  });
});

describe("findOverlappingSignup", () => {
  const findFirst = vi.fn();

  beforeEach(() => {
    findFirst.mockReset().mockResolvedValue(null);
    // @ts-expect-error - the shared test mock only stubs the models it needs.
    prisma.signup = { findFirst };
  });

  it("asks the database for a half-open time overlap", async () => {
    await findOverlappingSignup({
      userId: "u1",
      shiftStart: toastElevenThirty.start,
      shiftEnd: toastElevenThirty.end,
    });

    const where = findFirst.mock.calls[0][0].where;
    expect(where.shift).toEqual({
      start: { lt: toastElevenThirty.end },
      end: { gt: toastElevenThirty.start },
    });
    expect(where.status).toEqual({ in: ["CONFIRMED", "PENDING"] });
  });

  it("excludes the shift being signed up for when asked", async () => {
    await findOverlappingSignup({
      userId: "u1",
      shiftStart: toastElevenThirty.start,
      shiftEnd: toastElevenThirty.end,
      excludeShiftId: "shift-1",
    });

    expect(findFirst.mock.calls[0][0].where.shiftId).toEqual({ not: "shift-1" });
  });

  it("does not filter by shift id when no exclusion is given", async () => {
    await findOverlappingSignup({
      userId: "u1",
      shiftStart: toastElevenThirty.start,
      shiftEnd: toastElevenThirty.end,
    });

    expect(findFirst.mock.calls[0][0].where.shiftId).toBeUndefined();
  });
});
