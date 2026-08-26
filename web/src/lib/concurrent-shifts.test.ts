import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "./prisma";
import {
  buildPeriodConflictMessage,
  findPeriodConflictSignup,
  getShiftPeriodLabel,
  isAMShift,
} from "./concurrent-shifts";

/** 30 Aug 2026 is NZST (UTC+12), so 3pm NZ === 03:00 UTC. */
const onehungaThreePM = new Date("2026-08-30T03:00:00Z");
/** 11:30am NZ on the same day. */
const toastElevenThirty = new Date("2026-08-29T23:30:00Z");
/** 5pm NZ on the same day. */
const eveningFivePM = new Date("2026-08-30T05:00:00Z");

const formatNZ = (d: Date) =>
  new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Pacific/Auckland",
  }).format(d);

const conflict = (start: Date, status = "CONFIRMED") => ({
  status,
  shift: { start, location: "Onehunga", shiftType: { name: "Sunday Kitchen Prep (Onehunga)" } },
});

describe("getShiftPeriodLabel", () => {
  it("treats 3pm as Day, not Evening — the boundary is 4pm", () => {
    expect(isAMShift(onehungaThreePM)).toBe(true);
    expect(getShiftPeriodLabel(onehungaThreePM)).toBe("Day");
  });

  it("treats 5pm as Evening", () => {
    expect(getShiftPeriodLabel(eveningFivePM)).toBe("Evening");
  });
});

describe("buildPeriodConflictMessage", () => {
  it("never calls a 3pm blocking shift an AM shift", () => {
    const message = buildPeriodConflictMessage({
      conflictingSignup: conflict(onehungaThreePM),
      shiftStart: toastElevenThirty,
    });

    expect(message).not.toMatch(/\bAM\b/);
    expect(message).not.toMatch(/\bPM\b/);
    expect(message).toContain("a confirmed day shift on Sunday 30 August");
    expect(message).toContain("Sunday Kitchen Prep (Onehunga) at Onehunga, 3:00 pm");
    expect(message).toContain("only one of each is allowed per day");
  });

  it("explains the 4pm boundary so a 3:00 pm 'day shift' reads correctly", () => {
    const message = buildPeriodConflictMessage({
      conflictingSignup: conflict(onehungaThreePM),
      shiftStart: toastElevenThirty,
    });

    expect(message).toContain("Day shifts start before 4pm");
    expect(message).toContain("evening shifts start from 4pm");
  });

  it("calls a pending signup pending rather than confirmed", () => {
    const message = buildPeriodConflictMessage({
      conflictingSignup: conflict(onehungaThreePM, "PENDING"),
      shiftStart: toastElevenThirty,
    });

    expect(message).toContain("a pending day shift");
    expect(message).not.toContain("confirmed");
  });

  it("labels the period of the shift being blocked, not the blocking one", () => {
    const message = buildPeriodConflictMessage({
      conflictingSignup: conflict(eveningFivePM),
      shiftStart: eveningFivePM,
    });

    expect(message).toContain("evening shift on Sunday 30 August");
  });

  it("addresses admins about the volunteer", () => {
    const message = buildPeriodConflictMessage({
      conflictingSignup: conflict(onehungaThreePM),
      shiftStart: toastElevenThirty,
      subject: "volunteer",
    });

    expect(message).toMatch(/^This volunteer already has a confirmed day shift/);
  });

  it("falls back to TBD when the blocking shift has no location", () => {
    const message = buildPeriodConflictMessage({
      conflictingSignup: {
        status: "CONFIRMED",
        shift: { start: onehungaThreePM, location: null, shiftType: { name: "Kitchen Prep" } },
      },
      shiftStart: toastElevenThirty,
    });

    expect(message).toContain("Kitchen Prep at TBD");
  });
});

describe("findPeriodConflictSignup", () => {
  const findMany = vi.fn();

  beforeEach(() => {
    findMany.mockReset().mockResolvedValue([]);
    // @ts-expect-error - the shared test mock only stubs the models it needs.
    prisma.signup = { findMany };
  });

  const windowOf = async (shiftStart: Date) => {
    await findPeriodConflictSignup({ userId: "u1", shiftStart });
    return findMany.mock.calls[0][0].where.shift.start as { gte: Date; lt: Date };
  };

  it("covers a 25-hour NZ day, so a late shift on the April DST switch still clashes", async () => {
    // 5 Apr 2026: clocks go back, so 11:30pm NZ is 25h after local midnight.
    const lateOnDstDay = new Date("2026-04-05T11:30:00Z"); // 11:30pm NZ
    expect(formatNZ(lateOnDstDay)).toBe("2026-04-05 23:30");

    const window = await windowOf(new Date("2026-04-05T00:00:00Z"));
    expect(lateOnDstDay.getTime()).toBeGreaterThanOrEqual(window.gte.getTime());
    expect(lateOnDstDay.getTime()).toBeLessThan(window.lt.getTime());
  });

  it("still rejects a signup on the neighbouring NZ day pulled in by the padding", async () => {
    const nextDayShift = {
      status: "CONFIRMED",
      shift: {
        // 12:00pm NZ on 4 Sep — inside the padded window, wrong calendar day.
        start: new Date("2026-09-04T00:00:00Z"),
        location: "Onehunga",
        shiftType: { name: "Kitchen Prep" },
      },
    };
    findMany.mockResolvedValue([nextDayShift]);

    const conflict = await findPeriodConflictSignup({
      userId: "u1",
      shiftStart: new Date("2026-09-02T23:30:00Z"), // 11:30am NZ on 3 Sep
    });

    expect(conflict).toBeUndefined();
  });

  it("matches a same-day, same-period signup", async () => {
    const sameDay = {
      status: "CONFIRMED",
      shift: {
        start: new Date("2026-09-03T03:00:00Z"), // 3:00pm NZ on 3 Sep — day period
        location: "Onehunga",
        shiftType: { name: "Sunday Kitchen Prep (Onehunga)" },
      },
    };
    findMany.mockResolvedValue([sameDay]);

    const conflict = await findPeriodConflictSignup({
      userId: "u1",
      shiftStart: new Date("2026-09-02T23:30:00Z"), // 11:30am NZ on 3 Sep
    });

    expect(conflict).toBe(sameDay);
  });
});
