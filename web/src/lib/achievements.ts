import { prisma } from "@/lib/prisma";
import {
  differenceInHours,
  differenceInMonths,
  differenceInYears,
  format,
} from "date-fns";

export interface AchievementCriteria {
  type:
    | "shifts_completed"
    | "hours_volunteered"
    | "consecutive_months"
    | "specific_shift_type"
    | "years_volunteering"
    | "community_impact";
  value: number;
  shiftType?: string;
  timeframe?: "month" | "year" | "all_time";
}

export interface UserProgress {
  shifts_completed: number;
  hours_volunteered: number;
  consecutive_months: number;
  years_volunteering: number;
  community_impact: number;
}

export const ACHIEVEMENT_DEFINITIONS = [
  // Milestone Achievements
  {
    name: "First Steps",
    description: "Complete your first volunteer shift",
    category: "MILESTONE" as const,
    icon: "🌟",
    criteria: JSON.stringify({
      type: "shifts_completed",
      value: 1,
    }),
    points: 10,
  },
  {
    name: "Getting Started",
    description: "Complete 5 volunteer shifts",
    category: "MILESTONE" as const,
    icon: "⭐",
    criteria: JSON.stringify({
      type: "shifts_completed",
      value: 5,
    }),
    points: 25,
  },
  {
    name: "Making a Difference",
    description: "Complete 10 volunteer shifts",
    category: "MILESTONE" as const,
    icon: "🎯",
    criteria: JSON.stringify({
      type: "shifts_completed",
      value: 10,
    }),
    points: 50,
  },
  {
    name: "Veteran Volunteer",
    description: "Complete 25 volunteer shifts",
    category: "MILESTONE" as const,
    icon: "🏆",
    criteria: JSON.stringify({
      type: "shifts_completed",
      value: 25,
    }),
    points: 100,
  },
  {
    name: "Community Champion",
    description: "Complete 50 volunteer shifts",
    category: "MILESTONE" as const,
    icon: "👑",
    criteria: JSON.stringify({
      type: "shifts_completed",
      value: 50,
    }),
    points: 200,
  },

  // Hour-based Achievements
  {
    name: "Time Keeper",
    description: "Volunteer for 10 hours",
    category: "DEDICATION" as const,
    icon: "⏰",
    criteria: JSON.stringify({
      type: "hours_volunteered",
      value: 10,
    }),
    points: 30,
  },
  {
    name: "Dedicated Helper",
    description: "Volunteer for 25 hours",
    category: "DEDICATION" as const,
    icon: "💪",
    criteria: JSON.stringify({
      type: "hours_volunteered",
      value: 25,
    }),
    points: 75,
  },
  {
    name: "Marathon Volunteer",
    description: "Volunteer for 50 hours",
    category: "DEDICATION" as const,
    icon: "🏃",
    criteria: JSON.stringify({
      type: "hours_volunteered",
      value: 50,
    }),
    points: 150,
  },
  {
    name: "Century Club",
    description: "Volunteer for 100 hours",
    category: "DEDICATION" as const,
    icon: "💯",
    criteria: JSON.stringify({
      type: "hours_volunteered",
      value: 100,
    }),
    points: 300,
  },

  // Consistency Achievements
  {
    name: "Consistent Helper",
    description: "Volunteer for 3 consecutive months",
    category: "DEDICATION" as const,
    icon: "📅",
    criteria: JSON.stringify({
      type: "consecutive_months",
      value: 3,
    }),
    points: 50,
  },
  {
    name: "Reliable Volunteer",
    description: "Volunteer for 6 consecutive months",
    category: "DEDICATION" as const,
    icon: "🗓️",
    criteria: JSON.stringify({
      type: "consecutive_months",
      value: 6,
    }),
    points: 100,
  },
  {
    name: "Year-Round Helper",
    description: "Volunteer for 12 consecutive months",
    category: "DEDICATION" as const,
    icon: "🎊",
    criteria: JSON.stringify({
      type: "consecutive_months",
      value: 12,
    }),
    points: 200,
  },

  // Anniversary Achievements
  {
    name: "One Year Strong",
    description: "Volunteer for one full year",
    category: "MILESTONE" as const,
    icon: "🎂",
    criteria: JSON.stringify({
      type: "years_volunteering",
      value: 1,
    }),
    points: 150,
  },
  {
    name: "Two Year Veteran",
    description: "Volunteer for two full years",
    category: "MILESTONE" as const,
    icon: "🎉",
    criteria: JSON.stringify({
      type: "years_volunteering",
      value: 2,
    }),
    points: 300,
  },

  // Community Impact
  {
    name: "Meal Master",
    description: "Help prepare an estimated 100 meals",
    category: "IMPACT" as const,
    icon: "🍽️",
    criteria: JSON.stringify({
      type: "community_impact",
      value: 100,
    }),
    points: 75,
  },
  {
    name: "Food Hero",
    description: "Help prepare an estimated 500 meals",
    category: "IMPACT" as const,
    icon: "🦸",
    criteria: JSON.stringify({
      type: "community_impact",
      value: 500,
    }),
    points: 200,
  },
  {
    name: "Hunger Fighter",
    description: "Help prepare an estimated 1000 meals",
    category: "IMPACT" as const,
    icon: "⚔️",
    criteria: JSON.stringify({
      type: "community_impact",
      value: 1000,
    }),
    points: 400,
  },
];

export async function calculateUserProgress(
  userId: string
): Promise<UserProgress> {
  // Get user's completed shifts
  const completedShifts = await prisma.signup.findMany({
    where: {
      userId,
      status: "CONFIRMED",
      shift: { end: { lt: new Date() } },
    },
    include: {
      shift: {
        include: { shiftType: true },
      },
    },
    orderBy: { shift: { start: "asc" } },
  });

  // Get user's registration date
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });

  if (!user) {
    return {
      shifts_completed: 0,
      hours_volunteered: 0,
      consecutive_months: 0,
      years_volunteering: 0,
      community_impact: 0,
    };
  }

  // Calculate metrics
  const totalShifts = completedShifts.length;
  const totalHours = completedShifts.reduce(
    (total: number, signup: (typeof completedShifts)[0]) =>
      total + differenceInHours(signup.shift.end, signup.shift.start),
    0
  );
  const estimatedMeals = totalHours * 15; // ~15 meals per hour
  const yearsVolunteering = differenceInYears(new Date(), user.createdAt);

  // Calculate consecutive months (simplified - volunteers who have at least one shift per month)
  const monthlyActivity = new Map<string, boolean>();
  completedShifts.forEach((signup: (typeof completedShifts)[0]) => {
    const monthKey = format(signup.shift.start, "yyyy-MM");
    monthlyActivity.set(monthKey, true);
  });

  // Find longest consecutive sequence
  let consecutiveMonths = 0;
  let currentStreak = 0;
  const sortedMonths = Array.from(monthlyActivity.keys()).sort();

  for (let i = 0; i < sortedMonths.length; i++) {
    if (i === 0) {
      currentStreak = 1;
    } else {
      const [prevYear, prevMonth] = sortedMonths[i - 1].split("-").map(Number);
      const [currYear, currMonth] = sortedMonths[i].split("-").map(Number);

      const prevDate = new Date(prevYear, prevMonth);
      const currDate = new Date(currYear, currMonth);
      const monthsDiff = differenceInMonths(currDate, prevDate);

      if (monthsDiff === 1) {
        // Exactly one month apart - consecutive
        currentStreak++;
      } else {
        consecutiveMonths = Math.max(consecutiveMonths, currentStreak);
        currentStreak = 1;
      }
    }
  }
  consecutiveMonths = Math.max(consecutiveMonths, currentStreak);

  return {
    shifts_completed: totalShifts,
    hours_volunteered: totalHours,
    consecutive_months: consecutiveMonths,
    years_volunteering: yearsVolunteering,
    community_impact: estimatedMeals,
  };
}

export async function checkAndUnlockAchievements(userId: string) {
  const progress = await calculateUserProgress(userId);
  const unlockedAchievements: string[] = [];

  // Get all achievements and user's current achievements
  const [allAchievements, userAchievements] = await Promise.all([
    prisma.achievement.findMany({ where: { isActive: true } }),
    prisma.userAchievement.findMany({
      where: { userId },
      select: { achievementId: true },
    }),
  ]);

  const unlockedAchievementIds = new Set(
    userAchievements.map((ua: { achievementId: string }) => ua.achievementId)
  );

  for (const achievement of allAchievements) {
    if (unlockedAchievementIds.has(achievement.id)) continue;

    try {
      const criteria: AchievementCriteria = JSON.parse(achievement.criteria);
      let shouldUnlock = false;

      switch (criteria.type) {
        case "shifts_completed":
          shouldUnlock = progress.shifts_completed >= criteria.value;
          break;
        case "hours_volunteered":
          shouldUnlock = progress.hours_volunteered >= criteria.value;
          break;
        case "consecutive_months":
          shouldUnlock = progress.consecutive_months >= criteria.value;
          break;
        case "years_volunteering":
          shouldUnlock = progress.years_volunteering >= criteria.value;
          break;
        case "community_impact":
          shouldUnlock = progress.community_impact >= criteria.value;
          break;
        case "specific_shift_type":
          // Skip for now, not implemented
          break;
      }

      if (shouldUnlock) {
        await prisma.userAchievement.create({
          data: {
            userId,
            achievementId: achievement.id,
            progress: progress[criteria.type as keyof UserProgress] || 0,
          },
        });
        unlockedAchievements.push(achievement.name);
      }
    } catch (error) {
      console.error(`Error processing achievement ${achievement.name}:`, error);
    }
  }

  return unlockedAchievements;
}

export async function getUserAchievements(userId: string) {
  return await prisma.userAchievement.findMany({
    where: { userId },
    include: { achievement: true },
    orderBy: { unlockedAt: "desc" },
  });
}

export async function getAvailableAchievements(userId: string) {
  const userAchievements = await prisma.userAchievement.findMany({
    where: { userId },
    select: { achievementId: true },
  });

  const unlockedIds = new Set(
    userAchievements.map((ua: { achievementId: string }) => ua.achievementId)
  );

  return await prisma.achievement.findMany({
    where: {
      isActive: true,
      id: { notIn: Array.from(unlockedIds) },
    },
    orderBy: { points: "asc" },
  });
}
