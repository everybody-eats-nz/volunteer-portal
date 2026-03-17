import { AchievementsListClient } from "@/components/achievements-list-client";
import {
  getUserAchievements,
  getAvailableAchievements,
  calculateUserProgress,
  checkAndUnlockAchievements,
} from "@/lib/achievements";
import { prisma } from "@/lib/prisma";

export async function AchievementsList({ userId, skipUnlockCheck }: { userId: string; skipUnlockCheck?: boolean }) {
  // Calculate achievements based on current history (skip if already done at page level)
  if (!skipUnlockCheck) {
    await checkAndUnlockAchievements(userId);
  }

  // Get user's current achievements and available ones
  const [userAchievements, availableAchievements, progress, shiftTypes] =
    await Promise.all([
      getUserAchievements(userId),
      getAvailableAchievements(userId),
      calculateUserProgress(userId),
      prisma.shiftType.findMany({
        select: { id: true, name: true },
      }),
    ]);

  return (
    <AchievementsListClient
      userAchievements={userAchievements}
      availableAchievements={availableAchievements}
      progress={progress}
      shiftTypes={shiftTypes}
    />
  );
}
