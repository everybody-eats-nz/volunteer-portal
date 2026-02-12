import { describe, it, expect, beforeEach, vi } from "vitest";
import { autoCancelOtherPendingSignupsForDay } from "./signup-utils.server";
import { prisma } from "./prisma";

// Mock the prisma client
vi.mock("./prisma", () => ({
  prisma: {
    signup: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

describe("autoCancelOtherPendingSignupsForDay", () => {
  const userId = "test-user-123";
  const confirmedShiftId = "confirmed-shift-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should cancel only AM shifts when an AM shift is confirmed (before 4pm)", async () => {
    // Confirmed shift: 8:00 AM on Jan 15, 2025
    const confirmedShiftStart = new Date("2025-01-15T08:00:00+13:00"); // 8 AM NZDT

    // Other signups for the same day
    const otherSignups = [
      {
        id: "signup-1",
        userId,
        shiftId: "shift-1",
        status: "PENDING",
        shift: {
          id: "shift-1",
          start: new Date("2025-01-15T09:00:00+13:00"), // 9 AM - should be canceled
          shiftType: { name: "Kitchen Prep" },
        },
      },
      {
        id: "signup-2",
        userId,
        shiftId: "shift-2",
        status: "PENDING",
        shift: {
          id: "shift-2",
          start: new Date("2025-01-15T17:00:00+13:00"), // 5 PM - should NOT be canceled (PM shift)
          shiftType: { name: "Dinner Service" },
        },
      },
      {
        id: "signup-3",
        userId,
        shiftId: "shift-3",
        status: "WAITLISTED",
        shift: {
          id: "shift-3",
          start: new Date("2025-01-15T14:30:00+13:00"), // 2:30 PM - should be canceled (still AM)
          shiftType: { name: "Lunch Service" },
        },
      },
    ];

    vi.mocked(prisma.signup.findMany).mockResolvedValue(otherSignups as any);
    vi.mocked(prisma.signup.updateMany).mockResolvedValue({ count: 2 } as any);

    const result = await autoCancelOtherPendingSignupsForDay(
      userId,
      confirmedShiftId,
      confirmedShiftStart
    );

    expect(result).toBe(2);
    expect(prisma.signup.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["signup-1", "signup-3"] },
      },
      data: expect.objectContaining({
        status: "CANCELED",
        cancellationReason: "Auto-canceled: Another AM shift was confirmed for this day",
      }),
    });
  });

  it("should cancel only PM shifts when a PM shift is confirmed (4pm and later)", async () => {
    // Confirmed shift: 5:00 PM on Jan 15, 2025
    const confirmedShiftStart = new Date("2025-01-15T17:00:00+13:00"); // 5 PM NZDT

    const otherSignups = [
      {
        id: "signup-1",
        userId,
        shiftId: "shift-1",
        status: "PENDING",
        shift: {
          id: "shift-1",
          start: new Date("2025-01-15T09:00:00+13:00"), // 9 AM - should NOT be canceled (AM shift)
          shiftType: { name: "Kitchen Prep" },
        },
      },
      {
        id: "signup-2",
        userId,
        shiftId: "shift-2",
        status: "PENDING",
        shift: {
          id: "shift-2",
          start: new Date("2025-01-15T15:00:00+13:00"), // 3 PM - should NOT be canceled (AM shift)
          shiftType: { name: "Lunch Cleanup" },
        },
      },
      {
        id: "signup-3",
        userId,
        shiftId: "shift-3",
        status: "REGULAR_PENDING",
        shift: {
          id: "shift-3",
          start: new Date("2025-01-15T18:30:00+13:00"), // 6:30 PM - should be canceled (PM shift)
          shiftType: { name: "Dinner Cleanup" },
        },
      },
    ];

    vi.mocked(prisma.signup.findMany).mockResolvedValue(otherSignups as any);
    vi.mocked(prisma.signup.updateMany).mockResolvedValue({ count: 1 } as any);

    const result = await autoCancelOtherPendingSignupsForDay(
      userId,
      confirmedShiftId,
      confirmedShiftStart
    );

    expect(result).toBe(1);
    expect(prisma.signup.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["signup-3"] },
      },
      data: expect.objectContaining({
        status: "CANCELED",
        cancellationReason: "Auto-canceled: Another PM shift was confirmed for this day",
      }),
    });
  });

  it("should handle 4pm boundary correctly (4:00 PM is considered PM)", async () => {
    // Confirmed shift: 4:00 PM on Jan 15, 2025
    const confirmedShiftStart = new Date("2025-01-15T16:00:00+13:00"); // 4 PM NZDT

    const otherSignups = [
      {
        id: "signup-1",
        userId,
        shiftId: "shift-1",
        status: "PENDING",
        shift: {
          id: "shift-1",
          start: new Date("2025-01-15T15:59:00+13:00"), // 3:59 PM - should NOT be canceled (AM)
          shiftType: { name: "Lunch Cleanup" },
        },
      },
      {
        id: "signup-2",
        userId,
        shiftId: "shift-2",
        status: "PENDING",
        shift: {
          id: "shift-2",
          start: new Date("2025-01-15T16:01:00+13:00"), // 4:01 PM - should be canceled (PM)
          shiftType: { name: "Dinner Prep" },
        },
      },
      {
        id: "signup-3",
        userId,
        shiftId: "shift-3",
        status: "PENDING",
        shift: {
          id: "shift-3",
          start: new Date("2025-01-15T12:00:00+13:00"), // Noon - should NOT be canceled (AM)
          shiftType: { name: "Lunch Service" },
        },
      },
    ];

    vi.mocked(prisma.signup.findMany).mockResolvedValue(otherSignups as any);
    vi.mocked(prisma.signup.updateMany).mockResolvedValue({ count: 1 } as any);

    const result = await autoCancelOtherPendingSignupsForDay(
      userId,
      confirmedShiftId,
      confirmedShiftStart
    );

    expect(result).toBe(1);
    expect(prisma.signup.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["signup-2"] },
      },
      data: expect.objectContaining({
        status: "CANCELED",
        cancellationReason: "Auto-canceled: Another PM shift was confirmed for this day",
      }),
    });
  });

  it("should not cancel shifts on different days", async () => {
    // Confirmed shift: 9:00 AM on Jan 15, 2025
    const confirmedShiftStart = new Date("2025-01-15T09:00:00+13:00");

    const otherSignups = [
      {
        id: "signup-1",
        userId,
        shiftId: "shift-1",
        status: "PENDING",
        shift: {
          id: "shift-1",
          start: new Date("2025-01-16T09:00:00+13:00"), // Next day, same time - should NOT be canceled
          shiftType: { name: "Kitchen Prep" },
        },
      },
      {
        id: "signup-2",
        userId,
        shiftId: "shift-2",
        status: "PENDING",
        shift: {
          id: "shift-2",
          start: new Date("2025-01-14T09:00:00+13:00"), // Previous day, same time - should NOT be canceled
          shiftType: { name: "Kitchen Prep" },
        },
      },
    ];

    vi.mocked(prisma.signup.findMany).mockResolvedValue(otherSignups as any);

    const result = await autoCancelOtherPendingSignupsForDay(
      userId,
      confirmedShiftId,
      confirmedShiftStart
    );

    expect(result).toBe(0);
    expect(prisma.signup.updateMany).not.toHaveBeenCalled();
  });

  it("should return 0 when there are no other pending signups", async () => {
    const confirmedShiftStart = new Date("2025-01-15T09:00:00+13:00");

    vi.mocked(prisma.signup.findMany).mockResolvedValue([]);

    const result = await autoCancelOtherPendingSignupsForDay(
      userId,
      confirmedShiftId,
      confirmedShiftStart
    );

    expect(result).toBe(0);
    expect(prisma.signup.updateMany).not.toHaveBeenCalled();
  });

  it("should exclude the confirmed shift itself from cancellation", async () => {
    const confirmedShiftStart = new Date("2025-01-15T09:00:00+13:00");

    vi.mocked(prisma.signup.findMany).mockResolvedValue([]);

    await autoCancelOtherPendingSignupsForDay(
      userId,
      confirmedShiftId,
      confirmedShiftStart
    );

    expect(prisma.signup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          shiftId: {
            not: confirmedShiftId,
          },
        }),
      })
    );
  });

  it("should allow volunteers to have both AM and PM shifts on the same day", async () => {
    // Confirmed shift: 9:00 AM on Jan 15, 2025 (before 4pm = AM)
    const confirmedShiftStart = new Date("2025-01-15T09:00:00+13:00");

    const otherSignups = [
      {
        id: "signup-1",
        userId,
        shiftId: "shift-1",
        status: "PENDING",
        shift: {
          id: "shift-1",
          start: new Date("2025-01-15T10:00:00+13:00"), // 10 AM - should be canceled (AM)
          shiftType: { name: "Morning Prep" },
        },
      },
      {
        id: "signup-2",
        userId,
        shiftId: "shift-2",
        status: "PENDING",
        shift: {
          id: "shift-2",
          start: new Date("2025-01-15T17:00:00+13:00"), // 5 PM - should NOT be canceled (PM)
          shiftType: { name: "Dinner Service" },
        },
      },
    ];

    vi.mocked(prisma.signup.findMany).mockResolvedValue(otherSignups as any);
    vi.mocked(prisma.signup.updateMany).mockResolvedValue({ count: 1 } as any);

    const result = await autoCancelOtherPendingSignupsForDay(
      userId,
      confirmedShiftId,
      confirmedShiftStart
    );

    // Should only cancel the AM shift, not the PM shift
    expect(result).toBe(1);
    expect(prisma.signup.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["signup-1"] },
      },
      data: expect.any(Object),
    });
  });
});
