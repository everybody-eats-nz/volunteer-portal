import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Award, TrendingUp, Users } from "lucide-react";

interface AchievementsStatsProps {
  userId: string;
}

interface RankingData {
  userRank: number;
  totalUsers: number;
  percentile: number;
  nearbyUsers: Array<{
    rank: number;
    name: string;
    points: number;
    achievementCount: number;
  }>;
}

import { prisma } from "@/lib/prisma";
import {
  getUserAchievements,
  getAvailableAchievements,
  calculateUserProgress,
  checkAndUnlockAchievements,
} from "@/lib/achievements";

async function getAchievementsData(userId: string) {
  // Calculate achievements based on current history
  await checkAndUnlockAchievements(userId);

  // Get user's current achievements and available ones
  const [userAchievements, availableAchievements, progress] = await Promise.all([
    getUserAchievements(userId),
    getAvailableAchievements(userId),
    calculateUserProgress(userId),
  ]);

  // Calculate total points
  const totalPoints = userAchievements.reduce(
    (sum: number, ua) => sum + ua.achievement.points,
    0
  );

  // Get all users with their achievement points for ranking
  const allUsersWithPoints = await prisma.user.findMany({
    where: {
      role: "VOLUNTEER",
    },
    select: {
      id: true,
      name: true,
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
      name: u.name || "Anonymous",
      points: u.achievements.reduce(
        (sum, ua) => sum + ua.achievement.points,
        0
      ),
      achievementCount: u.achievements.length,
    }))
    .sort((a, b) => b.points - a.points);

  // Find user's rank
  const userRank = userRankings.findIndex((u) => u.id === userId) + 1;
  const totalUsers = userRankings.length;
  const percentile =
    totalUsers > 1
      ? Math.round(((totalUsers - userRank + 1) / totalUsers) * 100)
      : 100;

  // Get nearby users (3 above and 3 below, if available)
  const userIndex = userRank - 1;
  const startIndex = Math.max(0, userIndex - 3);
  const endIndex = Math.min(userRankings.length, userIndex + 4);
  const nearbyUsers = userRankings.slice(startIndex, endIndex).map((u, idx) => ({
    rank: startIndex + idx + 1,
    name:
      u.id === userId
        ? u.name
        : u.name.split(" ")[0] + " " + u.name.split(" ")[1]?.[0] + ".", // Anonymize others
    points: u.points,
    achievementCount: u.achievementCount,
  }));

  return {
    userAchievements,
    availableAchievements,
    progress,
    totalPoints,
    ranking: {
      userRank,
      totalUsers,
      percentile,
      nearbyUsers,
    },
  };
}

export async function AchievementsStats({ userId }: AchievementsStatsProps) {
  const data = await getAchievementsData(userId);
  const {
    userAchievements,
    availableAchievements,
    totalPoints,
    progress,
    ranking,
  } = data;

  const totalAchievements = userAchievements.length + availableAchievements.length;
  const completionRate = Math.round((userAchievements.length / totalAchievements) * 100);

  return (
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

      {/* Leaderboard Card - spans full width */}
      {ranking && (
        <Card className="md:col-span-2 lg:col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ranking.nearbyUsers.map((user) => {
                const isCurrentUser = user.rank === ranking.userRank;
                return (
                  <div
                    key={user.rank}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      isCurrentUser
                        ? "bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/30 dark:to-orange-900/30 border-yellow-200 dark:border-yellow-700"
                        : "bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex items-center justify-center w-8 h-8 rounded-full ${
                          user.rank === 1
                            ? "bg-yellow-400 text-yellow-900"
                            : user.rank === 2
                            ? "bg-gray-300 text-gray-900"
                            : user.rank === 3
                            ? "bg-orange-400 text-orange-900"
                            : "bg-muted text-muted-foreground"
                        } font-bold text-sm`}
                      >
                        {user.rank}
                      </div>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {user.name}
                          {isCurrentUser && (
                            <Badge variant="secondary" className="text-xs">
                              You
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {user.achievementCount} achievements
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">{user.points}</div>
                      <div className="text-xs text-muted-foreground">points</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
