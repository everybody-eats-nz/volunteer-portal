import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  getUserAchievements,
  getAvailableAchievements,
  checkAndUnlockAchievements,
  calculateUserProgress,
} from "@/lib/achievements";

export async function GET() {
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

    // Calculate achievements based on current history
    const newAchievements = await checkAndUnlockAchievements(user.id);

    // Get user's current achievements and available ones
    const [userAchievements, availableAchievements, progress] =
      await Promise.all([
        getUserAchievements(user.id),
        getAvailableAchievements(user.id),
        calculateUserProgress(user.id),
      ]);

    // Calculate total points
    const totalPoints = userAchievements.reduce(
      (sum: number, ua) => sum + ua.achievement.points,
      0
    );

    return NextResponse.json({
      userAchievements,
      availableAchievements,
      progress,
      totalPoints,
      newAchievements,
    });
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

    return NextResponse.json({
      newAchievements,
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
