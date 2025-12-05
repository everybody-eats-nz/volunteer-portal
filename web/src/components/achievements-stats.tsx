import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award, TrendingUp, Users, Trophy } from "lucide-react";
import { LeaderboardCard } from "@/components/leaderboard-card";
import { prisma } from "@/lib/prisma";
import {
  getUserAchievements,
  getAvailableAchievements,
  checkAndUnlockAchievements,
} from "@/lib/achievements";

interface AchievementsStatsProps {
  userId: string;
}

async function getAchievementsData(userId: string) {
  // Calculate achievements based on current history
  await checkAndUnlockAchievements(userId);

  // Get user's current achievements and available ones
  const [userAchievements, availableAchievements] = await Promise.all([
    getUserAchievements(userId),
    getAvailableAchievements(userId),
  ]);

  // Calculate total points
  const totalPoints = userAchievements.reduce(
    (sum: number, ua) => sum + ua.achievement.points,
    0
  );

  // Get all users with their achievement points for ranking (all locations)
  const allUsersWithPoints = await prisma.user.findMany({
    where: {
      role: "VOLUNTEER",
    },
    select: {
      id: true,
      achievements: {
        include: {
          achievement: {
            select: {
              points: true,
            },
          },
        },
      },
    },
  });

  // Calculate points for each user and sort
  const userRankings = allUsersWithPoints
    .map((u) => ({
      id: u.id,
      points: u.achievements.reduce(
        (sum, ua) => sum + ua.achievement.points,
        0
      ),
    }))
    .sort((a, b) => b.points - a.points);

  // Find user's rank
  const userRank = userRankings.findIndex((u) => u.id === userId) + 1;
  const totalUsers = userRankings.length;
  const percentile =
    totalUsers > 1
      ? Math.round(((totalUsers - userRank + 1) / totalUsers) * 100)
      : 100;

  return {
    userAchievements,
    availableAchievements,
    totalPoints,
    ranking: {
      userRank,
      totalUsers,
      percentile,
    },
  };
}

export async function AchievementsStats({ userId }: AchievementsStatsProps) {
  const data = await getAchievementsData(userId);
  const { userAchievements, availableAchievements, totalPoints, ranking } =
    data;

  const totalAchievements =
    userAchievements.length + availableAchievements.length;
  const completionRate = Math.round(
    (userAchievements.length / totalAchievements) * 100
  );

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        {/* Total Points */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Points</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPoints}</div>
            <p className="text-xs text-muted-foreground">
              From {userAchievements.length} achievements
            </p>
          </CardContent>
        </Card>

        {/* Achievements Unlocked */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unlocked</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {userAchievements.length}/{totalAchievements}
            </div>
            <p className="text-xs text-muted-foreground">
              {completionRate}% completion rate
            </p>
          </CardContent>
        </Card>

        {/* Your Rank */}
        {ranking && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Your Rank</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                #{ranking.userRank}
                <span className="text-sm text-muted-foreground ml-2">
                  of {ranking.totalUsers}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Top {100 - ranking.percentile}% of volunteers
              </p>
            </CardContent>
          </Card>
        )}

        {/* Percentile */}
        {ranking && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Percentile</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{ranking.percentile}th</div>
              <p className="text-xs text-muted-foreground">
                Better than {ranking.percentile}% of volunteers
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Leaderboard Card with location filtering */}
      <div className="mb-6">
        <LeaderboardCard />
      </div>
    </>
  );
}
