import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    signup: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
    mealsServed: { findMany: vi.fn() },
    location: { findMany: vi.fn() },
    friendship: { count: vi.fn() },
    passkey: { count: vi.fn() },
    achievement: { findMany: vi.fn() },
    userAchievement: { findMany: vi.fn(), createMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { calculateUserProgress, checkAndUnlockAchievements } from "./achievements";

type Mock = ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
  signup: { findMany: Mock };
  user: { findUnique: Mock };
  mealsServed: { findMany: Mock };
  location: { findMany: Mock };
  friendship: { count: Mock };
  passkey: { count: Mock };
  achievement: { findMany: Mock };
  userAchievement: { findMany: Mock; createMany: Mock };
};

/** A completed signup for a shift of `minutes` length on 2026-09-`day`. */
function completedSignup(day: number, minutes: number) {
  const start = new Date(`2026-09-${String(day).padStart(2, "0")}T05:00:00Z`);
  return {
    shift: {
      start,
      end: new Date(start.getTime() + minutes * 60_000),
      location: "Wellington",
      shiftTypeId: "kitchen",
    },
  };
}

describe("achievement hours", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({
      createdAt: new Date("2025-01-01"),
      completedShiftAdjustment: 0,
    });
    mockPrisma.mealsServed.findMany.mockResolvedValue([]);
    mockPrisma.location.findMany.mockResolvedValue([]);
    mockPrisma.friendship.count.mockResolvedValue(0);
    mockPrisma.passkey.count.mockResolvedValue(0);
    mockPrisma.userAchievement.findMany.mockResolvedValue([]);
    mockPrisma.userAchievement.createMany.mockResolvedValue({ count: 1 });
  });

  it("credits partial hours on each shift", async () => {
    mockPrisma.signup.findMany.mockResolvedValue([
      completedSignup(1, 150), // 2.5h
      completedSignup(2, 150), // 2.5h
      completedSignup(3, 105), // 1.75h
    ]);

    const progress = await calculateUserProgress("user-1");

    // Truncating each shift to whole hours used to give 2 + 2 + 1 = 5
    expect(progress.hours_volunteered).toBe(6.75);
  });

  it("keeps the meals estimate a whole number with partial hours", async () => {
    mockPrisma.signup.findMany.mockResolvedValue([completedSignup(1, 150)]);

    const progress = await calculateUserProgress("user-1");

    // No location data: 2.5h x 15 meals/hour
    expect(progress.community_impact).toBe(37);
  });

  it("unlocks an hours achievement once partial hours reach the target", async () => {
    // Four 2.5h shifts = 10h (8h when truncated per shift)
    mockPrisma.signup.findMany.mockResolvedValue(
      [1, 2, 3, 4].map((day) => completedSignup(day, 150))
    );
    mockPrisma.achievement.findMany.mockResolvedValue([
      {
        id: "ten-hours",
        name: "Ten Hours",
        criteria: JSON.stringify({ type: "hours_volunteered", value: 10 }),
      },
    ]);

    const unlocked = await checkAndUnlockAchievements("user-1");

    expect(unlocked).toEqual(["Ten Hours"]);
  });

  it("stores whole hours in the Int progress column", async () => {
    // Five 2.5h shifts = 12.5h
    mockPrisma.signup.findMany.mockResolvedValue(
      [1, 2, 3, 4, 5].map((day) => completedSignup(day, 150))
    );
    mockPrisma.achievement.findMany.mockResolvedValue([
      {
        id: "ten-hours",
        name: "Ten Hours",
        criteria: JSON.stringify({ type: "hours_volunteered", value: 10 }),
      },
    ]);

    await checkAndUnlockAchievements("user-1");

    expect(mockPrisma.userAchievement.createMany).toHaveBeenCalledWith({
      data: { userId: "user-1", achievementId: "ten-hours", progress: 12 },
      skipDuplicates: true,
    });
  });
});
