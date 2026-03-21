import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";
import {
  getUserAchievements,
  getAvailableAchievements,
  checkAndUnlockAchievements,
  calculateUserProgress,
  type UserProgress,
} from "@/lib/achievements";

/**
 * GET /api/mobile/profile
 *
 * Returns the full profile for the authenticated mobile user, including:
 * - profile details
 * - volunteer stats (shifts, hours, people served, streak)
 * - achievements (unlocked + in-progress)
 * - volunteer grade
 */
export async function GET(request: Request) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = auth;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        pronouns: true,
        profilePhotoUrl: true,
        role: true,
        dateOfBirth: true,
        emergencyContactName: true,
        emergencyContactRelationship: true,
        emergencyContactPhone: true,
        createdAt: true,
        customLabels: {
          select: {
            label: { select: { name: true, color: true } },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Calculate stats from signup history
    const now = new Date();

    const [completedSignups, shiftHours, progress] = await Promise.all([
      prisma.signup.count({
        where: {
          userId,
          status: "CONFIRMED",
          shift: { end: { lt: now } },
        },
      }),
      prisma.signup.findMany({
        where: {
          userId,
          status: "CONFIRMED",
          shift: { end: { lt: now } },
        },
        select: {
          shift: { select: { start: true, end: true } },
        },
      }),
      calculateUserProgress(userId),
    ]);

    const hoursContributed = shiftHours.reduce((sum, s) => {
      const ms = s.shift.end.getTime() - s.shift.start.getTime();
      return sum + ms / (1000 * 60 * 60);
    }, 0);

    const peopleServed = completedSignups * 15;
    const streak = progress.consecutive_months ?? 0;

    // Determine volunteer grade from custom labels
    const gradeNames = ["GREEN", "YELLOW", "PINK"];
    const gradeLabel = user.customLabels.find((cl) =>
      gradeNames.includes(cl.label.name.toUpperCase())
    );
    const volunteerGrade = gradeLabel
      ? (gradeLabel.label.name.toUpperCase() as "GREEN" | "YELLOW" | "PINK")
      : "GREEN";

    // Fetch achievements
    await checkAndUnlockAchievements(userId);
    const [userAchievements, availableAchievements] = await Promise.all([
      getUserAchievements(userId),
      getAvailableAchievements(userId),
    ]);

    const totalPoints = userAchievements.reduce(
      (sum, ua) => sum + ua.achievement.points,
      0
    );

    // Map achievements to mobile shape
    const achievements = [
      ...userAchievements.map((ua) => ({
        id: ua.achievement.id,
        name: ua.achievement.name,
        description: ua.achievement.description,
        icon: ua.achievement.icon || "🏆",
        category: ua.achievement.category,
        points: ua.achievement.points,
        unlockedAt: ua.unlockedAt.toISOString(),
      })),
      ...availableAchievements.map((a) => {
        const parsed = parseCriteria(a.criteria);
        return {
          id: a.id,
          name: a.name,
          description: a.description,
          icon: a.icon || "🔒",
          category: a.category,
          points: a.points,
          progress: parsed
            ? getProgressForCriteria(parsed, progress)
            : undefined,
          target: parsed
            ? `${parsed.value} ${parsed.type === "shifts_completed" ? "shifts" : parsed.type === "hours_volunteered" ? "hours" : ""}`
                .trim()
            : undefined,
        };
      }),
    ];

    return NextResponse.json({
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        pronouns: user.pronouns,
        image: user.profilePhotoUrl,
        role: user.role,
        volunteerGrade,
        memberSince: user.createdAt.toISOString(),
      },
      stats: {
        shiftsCompleted: completedSignups,
        hoursContributed: Math.round(hoursContributed),
        peopleServed,
        currentStreak: streak,
      },
      achievements,
      totalPoints,
    });
  } catch (error) {
    console.error("Mobile profile error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function parseCriteria(
  criteria: string
): { type: string; value: number } | null {
  try {
    const parsed = JSON.parse(criteria);
    if (typeof parsed.type === "string" && typeof parsed.value === "number") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function getProgressForCriteria(
  criteria: { type: string; value: number },
  progress: UserProgress
): number | undefined {
  const current = progress[criteria.type as keyof UserProgress];
  if (typeof current === "number") {
    return Math.min(current / criteria.value, 0.99);
  }
  return undefined;
}
