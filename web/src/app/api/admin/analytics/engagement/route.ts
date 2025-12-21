import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { addDays, format, startOfMonth } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get("startDate")
      ? new Date(searchParams.get("startDate")!)
      : addDays(new Date(), -90);
    const endDate = searchParams.get("endDate")
      ? new Date(searchParams.get("endDate")!)
      : new Date();

    // Fetch new registrations in period
    const [newRegistrations, totalVolunteers] = await Promise.all([
      prisma.user.findMany({
        where: {
          role: "VOLUNTEER",
          createdAt: { gte: startDate, lte: endDate },
        },
        select: {
          id: true,
          createdAt: true,
          signups: {
            where: {
              status: "CONFIRMED",
              shift: {
                end: { lt: new Date() },
              },
            },
            take: 1,
          },
        },
      }),
      prisma.user.count({
        where: { role: "VOLUNTEER" },
      }),
    ]);

    // Calculate activation (volunteers who completed at least 1 shift)
    const activatedVolunteers = newRegistrations.filter(
      (user) => user.signups.length > 0
    );

    const growthMetrics = {
      newRegistrations: newRegistrations.length,
      activatedVolunteers: activatedVolunteers.length,
      activationRate:
        newRegistrations.length > 0
          ? Math.round(
              (activatedVolunteers.length / newRegistrations.length) * 100
            )
          : 0,
      totalVolunteers,
    };

    // Registration trend by month
    const registrationMap = new Map<
      string,
      { month: string; newRegistrations: number; activated: number }
    >();

    newRegistrations.forEach((user) => {
      const monthKey = format(startOfMonth(user.createdAt), "yyyy-MM");

      if (!registrationMap.has(monthKey)) {
        registrationMap.set(monthKey, {
          month: monthKey,
          newRegistrations: 0,
          activated: 0,
        });
      }

      const monthData = registrationMap.get(monthKey)!;
      monthData.newRegistrations++;

      if (user.signups.length > 0) {
        monthData.activated++;
      }
    });

    const registrationTrend = Array.from(registrationMap.values())
      .map((item) => ({
        ...item,
        activationRate:
          item.newRegistrations > 0
            ? Math.round((item.activated / item.newRegistrations) * 100)
            : 0,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Achievement stats
    const [achievementUnlocks, , allVolunteers] =
      await Promise.all([
        prisma.userAchievement.findMany({
          where: {
            unlockedAt: { gte: startDate, lte: endDate },
          },
          select: {
            achievementId: true,
            achievement: {
              select: {
                name: true,
              },
            },
          },
        }),
        prisma.achievement.count({
          where: { isActive: true },
        }),
        prisma.user.count({
          where: { role: "VOLUNTEER" },
        }),
      ]);

    // Top achievements
    const achievementMap = new Map<string, { name: string; count: number }>();

    achievementUnlocks.forEach((unlock) => {
      const name = unlock.achievement.name;
      const existing = achievementMap.get(unlock.achievementId);

      if (existing) {
        existing.count++;
      } else {
        achievementMap.set(unlock.achievementId, { name, count: 1 });
      }
    });

    const topAchievements = Array.from(achievementMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((item) => ({
        achievementName: item.name,
        unlockCount: item.count,
      }));

    const achievementStats = {
      totalUnlocked: achievementUnlocks.length,
      averagePerVolunteer:
        allVolunteers > 0
          ? parseFloat((achievementUnlocks.length / allVolunteers).toFixed(1))
          : 0,
      topAchievements,
    };

    // Volunteer grade distribution
    const gradeData = await prisma.user.groupBy({
      by: ["volunteerGrade"],
      where: { role: "VOLUNTEER" },
      _count: { id: true },
    });

    const volunteerGradeDistribution = {
      GREEN:
        gradeData.find((g) => g.volunteerGrade === "GREEN")?._count.id || 0,
      YELLOW:
        gradeData.find((g) => g.volunteerGrade === "YELLOW")?._count.id || 0,
      PINK:
        gradeData.find((g) => g.volunteerGrade === "PINK")?._count.id || 0,
    };

    // Grade progression (simplified - just current distribution by month joined)
    // In a real implementation, you'd track historical grade changes
    const gradeProgression = registrationTrend.map((item) => ({
      month: item.month,
      gradeChanges: {
        greenToYellow: 0, // Would need historical data to calculate
        yellowToPink: 0,
      },
    }));

    return NextResponse.json({
      growthMetrics,
      registrationTrend,
      achievementStats,
      volunteerGradeDistribution,
      gradeProgression,
    });
  } catch (error) {
    console.error("Error fetching engagement analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch engagement analytics" },
      { status: 500 }
    );
  }
}
