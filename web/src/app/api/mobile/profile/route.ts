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
import { z } from "zod";

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
        medicalConditions: true,
        notificationPreference: true,
        receiveShortageNotifications: true,
        excludedShortageNotificationTypes: true,
        emailNewsletterSubscription: true,
        newsletterLists: true,
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
    const [userAchievements, availableAchievements, totalVolunteers] =
      await Promise.all([
        getUserAchievements(userId),
        getAvailableAchievements(userId),
        prisma.user.count({
          where: {
            role: "VOLUNTEER",
            signups: { some: { status: "CONFIRMED" } },
          },
        }),
      ]);

    // Count how many users have unlocked each achievement
    const allAchievementIds = [
      ...userAchievements.map((ua) => ua.achievement.id),
      ...availableAchievements.map((a) => a.id),
    ];
    const unlockCounts = await prisma.userAchievement.groupBy({
      by: ["achievementId"],
      where: { achievementId: { in: allAchievementIds } },
      _count: { userId: true },
    });
    const unlockCountMap = new Map(
      unlockCounts.map((uc) => [uc.achievementId, uc._count.userId])
    );

    // Find which friends have unlocked each achievement
    const friendIds = await prisma.friendship
      .findMany({
        where: {
          status: "ACCEPTED",
          OR: [{ userId }, { friendId: userId }],
        },
        select: { userId: true, friendId: true },
      })
      .then((rows) =>
        rows.map((r) => (r.userId === userId ? r.friendId : r.userId))
      );

    const friendUnlocks =
      friendIds.length > 0
        ? await prisma.userAchievement.findMany({
            where: {
              achievementId: { in: allAchievementIds },
              userId: { in: friendIds },
            },
            select: {
              achievementId: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  firstName: true,
                  profilePhotoUrl: true,
                },
              },
            },
          })
        : [];

    // Group friends by achievement
    const friendsByAchievement = new Map<
      string,
      Array<{ id: string; name: string; profilePhotoUrl?: string }>
    >();
    for (const fu of friendUnlocks) {
      const list = friendsByAchievement.get(fu.achievementId) ?? [];
      list.push({
        id: fu.user.id,
        name: fu.user.name ?? fu.user.firstName ?? "Volunteer",
        profilePhotoUrl: fu.user.profilePhotoUrl ?? undefined,
      });
      friendsByAchievement.set(fu.achievementId, list);
    }

    const totalPoints = userAchievements.reduce(
      (sum, ua) => sum + ua.achievement.points,
      0
    );

    // Map achievements to mobile shape
    // Unlocked: most recently unlocked first
    const unlocked = userAchievements
      .slice()
      .sort((a, b) => b.unlockedAt.getTime() - a.unlockedAt.getTime())
      .map((ua) => ({
        id: ua.achievement.id,
        name: ua.achievement.name,
        description: ua.achievement.description,
        icon: ua.achievement.icon || "🏆",
        category: ua.achievement.category,
        points: ua.achievement.points,
        unlockedAt: ua.unlockedAt.toISOString(),
        unlockedByCount: unlockCountMap.get(ua.achievement.id) ?? 0,
        friendsWhoEarned:
          friendsByAchievement.get(ua.achievement.id) ?? [],
      }));

    // In-progress: closest to completion first (highest progress)
    const inProgressList = availableAchievements
      .map((a) => {
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
          unlockedByCount: unlockCountMap.get(a.id) ?? 0,
          friendsWhoEarned: friendsByAchievement.get(a.id) ?? [],
        };
      })
      .sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0));

    const achievements = [...unlocked, ...inProgressList];

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
        dateOfBirth: user.dateOfBirth?.toISOString() ?? null,
        emergencyContactName: user.emergencyContactName,
        emergencyContactRelationship: user.emergencyContactRelationship,
        emergencyContactPhone: user.emergencyContactPhone,
        medicalConditions: user.medicalConditions,
        notificationPreference: user.notificationPreference,
        receiveShortageNotifications: user.receiveShortageNotifications,
        excludedShortageNotificationTypes: user.excludedShortageNotificationTypes,
        emailNewsletterSubscription: user.emailNewsletterSubscription,
        newsletterLists: user.newsletterLists,
      },
      stats: {
        shiftsCompleted: completedSignups,
        hoursContributed: Math.round(hoursContributed),
        peopleServed,
        currentStreak: streak,
      },
      achievements,
      totalPoints,
      totalVolunteers,
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

/**
 * PUT /api/mobile/profile
 *
 * Update the authenticated mobile user's profile.
 */
const updateMobileProfileSchema = z.object({
  firstName: z.string().min(1, "First name is required").optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  pronouns: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactRelationship: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  medicalConditions: z.string().optional(),
  notificationPreference: z.enum(["EMAIL", "SMS", "BOTH", "NONE"]).optional(),
  receiveShortageNotifications: z.boolean().optional(),
  excludedShortageNotificationTypes: z.array(z.string()).optional(),
  emailNewsletterSubscription: z.boolean().optional(),
  newsletterLists: z.array(z.string()).optional(),
});

export async function PUT(request: Request) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = updateMobileProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const profileFields = parsed.data;

    const data: Record<string, unknown> = { ...profileFields };

    // Update name field for display consistency
    if (profileFields.firstName || profileFields.lastName) {
      const user = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { firstName: true, lastName: true },
      });
      const first = profileFields.firstName ?? user?.firstName ?? "";
      const last = profileFields.lastName ?? user?.lastName ?? "";
      data.name = [first, last].filter(Boolean).join(" ");
    }

    const updatedUser = await prisma.user.update({
      where: { id: auth.userId },
      data,
      select: {
        firstName: true,
        lastName: true,
        phone: true,
        pronouns: true,
        profilePhotoUrl: true,
        emergencyContactName: true,
        emergencyContactRelationship: true,
        emergencyContactPhone: true,
        medicalConditions: true,
      },
    });

    return NextResponse.json({ profile: updatedUser });
  } catch (error) {
    console.error("Mobile profile update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
