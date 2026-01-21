import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  getUserAchievements,
  getAvailableAchievements,
  checkAndUnlockAchievements,
  calculateUserProgress,
} from "@/lib/achievements";
import { checkAndAssignSurveys } from "@/lib/survey-triggers";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find user in database
    const { prisma } = await import("@/lib/prisma");
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if detailed stats are requested
    const { searchParams } = new URL(request.url);
    const includeRanking = searchParams.get("includeRanking") === "true";

    // Calculate achievements based on current history
    const newAchievements = await checkAndUnlockAchievements(user.id);

    // Check and assign any triggered surveys
    const newSurveys = await checkAndAssignSurveys(user.id);
    if (newSurveys.length > 0) {
      console.log(`[SURVEYS] Assigned ${newSurveys.length} survey(s) to user ${user.id}`);
    }

    // Get user's current achievements and available ones
    const [userAchievements, availableAchievements, progress, shiftTypes] =
      await Promise.all([
        getUserAchievements(user.id),
        getAvailableAchievements(user.id),
        calculateUserProgress(user.id),
        prisma.shiftType.findMany({
          select: {
            id: true,
            name: true,
          },
        }),
      ]);

    // Calculate total points
    const totalPoints = userAchievements.reduce(
      (sum: number, ua) => sum + ua.achievement.points,
      0
    );

    const response: {
      userAchievements: typeof userAchievements;
      availableAchievements: typeof availableAchievements;
      progress: typeof progress;
      totalPoints: number;
      newAchievements: string[];
      shiftTypes: typeof shiftTypes;
      ranking?: {
        userRank: number;
        totalUsers: number;
        percentile: number;
        nearbyUsers: Array<{
          rank: number;
          name: string;
          points: number;
          achievementCount: number;
        }>;
      };
    } = {
      userAchievements,
      availableAchievements,
      progress,
      totalPoints,
      newAchievements,
      shiftTypes,
    };

    // Include ranking data if requested
    if (includeRanking) {
      // Get all users with their achievement points
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
      const userRank =
        userRankings.findIndex((u) => u.id === user.id) + 1;
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
        name: u.id === user.id ? u.name : u.name.split(" ")[0] + " " + u.name.split(" ")[1]?.[0] + ".", // Anonymize others
        points: u.points,
        achievementCount: u.achievementCount,
      }));

      response.ranking = {
        userRank,
        totalUsers,
        percentile,
        nearbyUsers,
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching achievements:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find user in database
    const { prisma } = await import("@/lib/prisma");
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check for new achievements
    const newAchievements = await checkAndUnlockAchievements(user.id);

    // Check and assign any triggered surveys
    const newSurveys = await checkAndAssignSurveys(user.id);

    return NextResponse.json({
      newAchievements,
      newSurveys,
      success: true,
    });
  } catch (error) {
    console.error("Error checking achievements:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
