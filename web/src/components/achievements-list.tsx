import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AchievementsListClient } from "@/components/achievements-list-client";
import {
  getUserAchievements,
  getAvailableAchievements,
  calculateUserProgress,
  checkAndUnlockAchievements,
} from "@/lib/achievements";

export async function AchievementsList({ userId }: { userId: string }) {
  // Calculate achievements based on current history
  await checkAndUnlockAchievements(userId);

  // Get user's current achievements and available ones
  const [userAchievements, availableAchievements, progress] = await Promise.all([
    getUserAchievements(userId),
    getAvailableAchievements(userId),
    calculateUserProgress(userId),
  ]);

  return (
    <AchievementsListClient
      userAchievements={userAchievements}
      availableAchievements={availableAchievements}
      progress={progress}
    />
  );
}
