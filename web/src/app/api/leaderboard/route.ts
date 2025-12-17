import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const location = searchParams.get("location") || "all";
  const showAll = searchParams.get("showAll") === "true";
  const userId = session.user.id;

  try {
    // Get all volunteers with their achievements
    // Note: For very large databases (10k+ volunteers), consider:
    // 1. Caching leaderboard results with periodic refresh
    // 2. Computing and storing total points in the User model
    // 3. Adding pagination at the API level
    // 4. Using database views or materialized views for rankings
    const allUsersWithPoints = await prisma.user.findMany({
      where: {
        role: "VOLUNTEER",
      },
      select: {
        id: true,
        name: true,
        achievements: {
          select: {
            achievement: {
              select: {
                points: true,
              },
            },
          },
        },
        signups: {
          where: {
            status: "CONFIRMED",
            shift: {
              end: { lt: new Date() },
              ...(location !== "all" && location ? { location } : {}),
            },
          },
          select: {
            id: true,
          },
        },
      },
    });

    // Filter users based on location
    const filteredUsers = location !== "all"
      ? allUsersWithPoints.filter(user => user.signups.length > 0)
      : allUsersWithPoints;

    // Calculate points for each user and sort
    const userRankings = filteredUsers
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

    // Get users to display based on showAll parameter
    const userIndex = userRank - 1;
    const startIndex = showAll ? 0 : Math.max(0, userIndex - 3); // Show all above if requested, otherwise 3
    const endIndex = Math.min(userRankings.length, userIndex + 4); // Always show current user + 3 below
    const nearbyUsers = userRankings.slice(startIndex, endIndex).map((u, idx) => ({
      rank: startIndex + idx + 1,
      name:
        u.id === userId
          ? u.name
          : u.name.split(" ")[0] + " " + u.name.split(" ")[1]?.[0] + ".", // Anonymize others
      points: u.points,
      achievementCount: u.achievementCount,
      isCurrentUser: u.id === userId,
    }));

    // Get all unique locations from shifts
    const locations = await prisma.shift.findMany({
      where: {
        location: { not: null },
      },
      select: {
        location: true,
      },
      distinct: ["location"],
      orderBy: {
        location: "asc",
      },
    });

    const uniqueLocations = locations
      .map((s) => s.location)
      .filter((loc): loc is string => loc !== null);

    return NextResponse.json({
      userRank,
      totalUsers,
      percentile,
      nearbyUsers,
      locations: uniqueLocations,
      hasMoreAbove: !showAll && userRank > 4, // True if there are users above the shown range
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}
