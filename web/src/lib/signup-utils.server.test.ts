import { describe, it, expect, beforeEach, vi } from "vitest";
import { autoCancelOverlappingPendingSignups } from "./signup-utils.server";
import { prisma } from "./prisma";

vi.mock("./prisma", () => ({
  prisma: {
    signup: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

const findMany = prisma.signup.findMany as unknown as ReturnType<typeof vi.fn>;
const updateMany = prisma.signup.updateMany as unknown as ReturnType<typeof vi.fn>;

const userId = "test-user-123";
const confirmedShiftId = "confirmed-shift-123";
// 12:00-16:00 NZDT on 15 Jan 2025.
const confirmedStart = new Date("2025-01-15T12:00:00+13:00");
const confirmedEnd = new Date("2025-01-15T16:00:00+13:00");

const run = () =>
  autoCancelOverlappingPendingSignups(
    userId,
    confirmedShiftId,
    confirmedStart,
    confirmedEnd
  );

describe("autoCancelOverlappingPendingSignups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findMany.mockResolvedValue([]);
    updateMany.mockResolvedValue({ count: 0 });
  });

  it("asks only for signups whose time overlaps the confirmed shift", async () => {
    await run();

    const where = findMany.mock.calls[0][0].where;
    expect(where.userId).toBe(userId);
    expect(where.shiftId).toEqual({ not: confirmedShiftId });
    // Half-open, so a shift starting exactly at 16:00 is not swept up.
    expect(where.shift).toEqual({
      start: { lt: confirmedEnd },
      end: { gt: confirmedStart },
    });
  });

  it("only ever touches signups that are not yet confirmed", async () => {
    await run();

    expect(findMany.mock.calls[0][0].where.status).toEqual({
      in: ["PENDING", "WAITLISTED", "REGULAR_PENDING"],
    });
  });

  it("cancels everything the overlap query returns", async () => {
    findMany.mockResolvedValue([{ id: "signup-1" }, { id: "signup-2" }]);

    const result = await run();

    expect(result).toBe(2);
    expect(updateMany).toHaveBeenCalledTimes(1);
    const call = updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: { in: ["signup-1", "signup-2"] } });
    expect(call.data.status).toBe("CANCELED");
    expect(call.data.canceledAt).toBeInstanceOf(Date);
  });

  it("explains the cancellation with the clashing shift's own times", async () => {
    findMany.mockResolvedValue([{ id: "signup-1" }]);

    await run();

    const reason = updateMany.mock.calls[0][0].data.cancellationReason;
    expect(reason).toContain("clashes with a confirmed shift");
    expect(reason).toContain("12:00 PM to 4:00 PM");
    expect(reason).toContain("Wednesday 15 January");
    // The rule is no longer AM/PM buckets, so the copy must not say otherwise.
    expect(reason).not.toMatch(/\bAM shift\b|\bPM shift\b/);
  });

  it("does nothing when no signup overlaps", async () => {
    findMany.mockResolvedValue([]);

    const result = await run();

    expect(result).toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
  });
});
