import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AchievementsListClient } from "@/components/achievements-list-client";
import {
  getUserAchievements,
  getAvailableAchievements,
  calculateUserProgress,
  checkAndUnlockAchievements,
} from "@/lib/achievements";
import { prisma } from "@/lib/prisma";

export async function AchievementsList({ userId }: { userId: string }) {
  // Calculate achievements based on current history
  await checkAndUnlockAchievements(userId);

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
