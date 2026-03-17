import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import {
  getUserAchievements,
  getAvailableAchievements,
  calculateUserProgress,
  checkAndUnlockAchievements,
} from "@/lib/achievements";
import AchievementsCard from "@/components/achievements-card";

export async function DashboardAchievementsServer() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  // Check and unlock achievements
  await checkAndUnlockAchievements(userId);

  // Fetch all data in parallel
  const [userAchievements, availableAchievements, progress, shiftTypes] =
    await Promise.all([
      getUserAchievements(userId),
      getAvailableAchievements(userId),
      calculateUserProgress(userId),
      prisma.shiftType.findMany({
        select: { id: true, name: true },
      }),
    ]);

  const totalPoints = userAchievements.reduce(
    (sum: number, ua) => sum + ua.achievement.points,
    0
  );

  return (
    <AchievementsCard
      initialData={{
        userAchievements: userAchievements.map((ua) => ({
          id: ua.id,
          unlockedAt: ua.unlockedAt.toISOString(),
          progress: ua.progress,
          achievement: {
            id: ua.achievement.id,
            name: ua.achievement.name,
            description: ua.achievement.description,
            category: ua.achievement.category,
            icon: ua.achievement.icon,
            points: ua.achievement.points,
            criteria: ua.achievement.criteria,
          },
        })),
        availableAchievements: availableAchievements.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          category: a.category,
          icon: a.icon,
          points: a.points,
          criteria: a.criteria,
        })),
        progress: {
          shifts_completed: progress.shifts_completed,
          hours_volunteered: progress.hours_volunteered,
          consecutive_months: progress.consecutive_months,
          years_volunteering: progress.years_volunteering,
          community_impact: progress.community_impact,
          friends_count: progress.friends_count,
          shift_type_counts: progress.shift_type_counts,
        },
        totalPoints,
        newAchievements: [],
        shiftTypes,
      }}
    />
  );
}
