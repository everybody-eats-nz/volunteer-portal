import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createRegularVolunteerSignups,
  type RegularVolunteerForMatching,
  type ShiftForMatching,
} from "./regular-volunteer-utils";
import { prisma } from "./prisma";

// The shared utility reads existing signups and writes Signup + RegularSignup
// rows; stub those calls so the matching logic runs without a database.
function stubPrisma(
  existing: Array<{
    userId: string;
    shiftId: string;
    shift: { start: Date; end: Date };
  }> = []
) {
  const signup = {
    findMany: vi.fn().mockResolvedValue(existing),
    createManyAndReturn: vi
      .fn()
      .mockImplementation(
        ({ data }: { data: Array<{ userId: string; shiftId: string }> }) =>
          Promise.resolve(
            data.map((d, i) => ({
              id: `signup-${i}`,
              userId: d.userId,
              shiftId: d.shiftId,
            }))
          )
      ),
  };
  const regularSignup = { createMany: vi.fn().mockResolvedValue({ count: 0 }) };
  Object.assign(prisma as unknown as Record<string, unknown>, {
    signup,
    regularSignup,
  });
  return { signup, regularSignup };
}

const baseRegular: Omit<RegularVolunteerForMatching, "id" | "shiftTypeId"> = {
  userId: "alison",
  location: "Wellington",
  frequency: "WEEKLY",
  availableDays: ["Wednesday"],
  autoApprove: true,
  createdAt: new Date("2026-08-01T00:00:00Z"),
};

// Wednesday 2 September 2026, NZST (UTC+12)
const prepShift: ShiftForMatching = {
  id: "shift-prep",
  shiftTypeId: "prep",
  location: "Wellington",
  start: new Date("2026-09-02T00:00:00Z"), // 12:00 NZT
  end: new Date("2026-09-02T04:00:00Z"), // 16:00 NZT
};
const serviceShift: ShiftForMatching = {
  id: "shift-service",
  shiftTypeId: "service",
  location: "Wellington",
  start: new Date("2026-09-02T05:30:00Z"), // 17:30 NZT
  end: new Date("2026-09-02T09:00:00Z"), // 21:00 NZT
};

const prepRegular: RegularVolunteerForMatching = {
  ...baseRegular,
  id: "reg-prep",
  shiftTypeId: "prep",
};
const serviceRegular: RegularVolunteerForMatching = {
  ...baseRegular,
  id: "reg-service",
  shiftTypeId: "service",
};

describe("createRegularVolunteerSignups", () => {
  beforeEach(() => {
    stubPrisma();
  });

  it("populates a day and an evening schedule the volunteer holds on the same day", async () => {
    const result = await createRegularVolunteerSignups(
      [prepShift, serviceShift],
      [prepRegular, serviceRegular],
      { dryRun: true }
    );

    expect(result.signupsCreated).toBe(2);
    expect(result.signupRecords.map((r) => r.shiftId).sort()).toEqual([
      "shift-prep",
      "shift-service",
    ]);
  });

  it("skips a shift that clashes in time with one the volunteer already has", async () => {
    stubPrisma([
      {
        userId: "alison",
        shiftId: "other-day-shift",
        // 13:00-15:00 NZT, inside the 12:00-16:00 prep shift.
        shift: {
          start: new Date("2026-09-02T01:00:00Z"),
          end: new Date("2026-09-02T03:00:00Z"),
        },
      },
    ]);

    const result = await createRegularVolunteerSignups(
      [prepShift, serviceShift],
      [prepRegular, serviceRegular],
      { dryRun: true }
    );

    expect(result.signupRecords.map((r) => r.shiftId)).toEqual([
      "shift-service",
    ]);
  });

  it("still fills a shift when an existing signup that day does not clash", async () => {
    stubPrisma([
      {
        userId: "alison",
        shiftId: "earlier-day-shift",
        // 08:00-11:00 NZT, finishing before the 12:00 prep shift starts.
        shift: {
          start: new Date("2026-09-01T20:00:00Z"),
          end: new Date("2026-09-01T23:00:00Z"),
        },
      },
    ]);

    const result = await createRegularVolunteerSignups(
      [prepShift, serviceShift],
      [prepRegular, serviceRegular],
      { dryRun: true }
    );

    // Under the old Day/Evening bucket the 8am signup blocked the midday prep
    // shift; only an actual time clash does now.
    expect(result.signupRecords.map((r) => r.shiftId)).toEqual([
      "shift-prep",
      "shift-service",
    ]);
  });

  it("treats a back-to-back signup as non-clashing", async () => {
    stubPrisma([
      {
        userId: "alison",
        shiftId: "abutting-shift",
        // Ends exactly as the 12:00 prep shift begins.
        shift: {
          start: new Date("2026-09-01T21:00:00Z"),
          end: new Date("2026-09-02T00:00:00Z"),
        },
      },
    ]);

    const result = await createRegularVolunteerSignups(
      [prepShift],
      [prepRegular],
      { dryRun: true }
    );

    expect(result.signupRecords.map((r) => r.shiftId)).toEqual(["shift-prep"]);
  });

  it("skips a shift the volunteer is already signed up for", async () => {
    stubPrisma([
      {
        userId: "alison",
        shiftId: "shift-prep",
        shift: { start: prepShift.start, end: prepShift.end },
      },
    ]);

    const result = await createRegularVolunteerSignups([prepShift], [prepRegular], {
      dryRun: true,
    });

    expect(result.signupsCreated).toBe(0);
  });

  it("gives one schedule a single signup when a day has two shifts of that type", async () => {
    const eveningPrep: ShiftForMatching = {
      ...prepShift,
      id: "shift-prep-2",
      start: serviceShift.start, // a second prep session, in the evening period
    };

    const result = await createRegularVolunteerSignups(
      [prepShift, eveningPrep],
      [prepRegular],
      { dryRun: true }
    );

    expect(result.signupRecords.map((r) => r.shiftId)).toEqual(["shift-prep"]);
  });

  it("still respects frequency filtering", async () => {
    const result = await createRegularVolunteerSignups(
      [prepShift],
      [{ ...prepRegular, frequency: "MONTHLY" }],
      { dryRun: true }
    );

    // 2 September 2026 is the first Wednesday of the month
    expect(result.signupsCreated).toBe(1);
  });
});
