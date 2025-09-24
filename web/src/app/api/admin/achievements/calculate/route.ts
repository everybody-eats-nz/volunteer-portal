import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  recalculateAllAchievements,
  calculateAchievementsForUser,
} from "@/lib/achievement-calculator";

/**
 * POST /api/admin/achievements/calculate
 *
 * Admin endpoint to manually trigger achievement calculations
 *
 * Body options:
 * - { type: "all" } - Recalculate for all users with completed shifts
 * - { type: "user", userId: "xxx" } - Calculate for specific user
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  // Check if user is admin
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { prisma } = await import("@/lib/prisma");
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true },
    });

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { type, userId } = body;

    let results;

    switch (type) {
      case "all":
        results = await recalculateAllAchievements();
        break;
      case "user":
        if (!userId) {
          return NextResponse.json(
            { error: "userId required for user calculation" },
            { status: 400 }
          );
        }
        const newAchievements = await calculateAchievementsForUser(userId);
        results = {
          usersProcessed: 1,
          newAchievements: newAchievements.length,
          errors: 0,
          achievements: newAchievements,
        };
        break;
      default:
        return NextResponse.json(
          { error: "Invalid calculation type. Use 'all' or 'user'" },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      type,
      results,
    });
  } catch (error) {
    console.error("Error calculating achievements:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
