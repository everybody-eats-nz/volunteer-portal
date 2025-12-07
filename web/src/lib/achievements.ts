import { prisma } from "@/lib/prisma";
import {
  differenceInHours,
  differenceInMonths,
  differenceInYears,
  startOfDay,
} from "date-fns";
import { formatInNZT, toUTC } from "@/lib/timezone";

export interface AchievementCriteria {
  type:
    | "shifts_completed"
    | "hours_volunteered"
    | "consecutive_months"
    | "specific_shift_type"
    | "years_volunteering"
    | "community_impact"
    | "friends_count";
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
  friends_count: number;
  shift_type_counts: Record<string, number>; // shiftTypeId -> count
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

  // Friend-based Community Achievements
  {
    name: "Social Butterfly",
    description: "Make 3 friends in the volunteer community",
    category: "COMMUNITY" as const,
    icon: "🦋",
    criteria: JSON.stringify({
      type: "friends_count",
      value: 3,
    }),
    points: 25,
  },
  {
    name: "Team Player",
    description: "Make 5 friends in the volunteer community",
    category: "COMMUNITY" as const,
    icon: "🤝",
    criteria: JSON.stringify({
      type: "friends_count",
      value: 5,
    }),
    points: 50,
  },
  {
    name: "Community Connector",
    description: "Make 10 friends in the volunteer community",
    category: "COMMUNITY" as const,
    icon: "🌐",
    criteria: JSON.stringify({
      type: "friends_count",
      value: 10,
    }),
    points: 100,
  },
  {
    name: "Networking Pro",
    description: "Make 20 friends in the volunteer community",
    category: "COMMUNITY" as const,
    icon: "🎭",
    criteria: JSON.stringify({
      type: "friends_count",
      value: 20,
    }),
    points: 200,
  },
  {
    name: "Community Leader",
    description: "Make 50 friends in the volunteer community",
    category: "COMMUNITY" as const,
    icon: "⭐",
    criteria: JSON.stringify({
      type: "friends_count",
      value: 50,
    }),
    points: 500,
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
      friends_count: 0,
      shift_type_counts: {},
    };
  }

  // Calculate metrics
  const totalShifts = completedShifts.length;
  const totalHours = completedShifts.reduce(
    (total: number, signup: (typeof completedShifts)[0]) =>
      total + differenceInHours(signup.shift.end, signup.shift.start),
    0
  );
  const yearsVolunteering = differenceInYears(new Date(), user.createdAt);

  // Calculate total meals served using actual data from mealsServed and location tables
  // Group shifts by date and location to get unique days
  const uniqueDays = new Map<string, { date: Date; location: string }>();
  completedShifts.forEach((signup: (typeof completedShifts)[0]) => {
    const shiftDate = signup.shift.start;
    const location = signup.shift.location || "Unknown";
    const dateKey = `${startOfDay(shiftDate).toISOString()}-${location}`;

    if (!uniqueDays.has(dateKey)) {
      uniqueDays.set(dateKey, {
        date: startOfDay(shiftDate),
        location,
      });
    }
  });

  // Fetch meals served records for those days
  const mealsServedRecords = await prisma.mealsServed.findMany({
    where: {
      OR: Array.from(uniqueDays.values()).map(({ date, location }) => ({
        date: toUTC(date),
        location,
      })),
    },
  });

  // Create a map of actual meals served by date-location key
  const actualMealsMap = new Map<string, number>();
  mealsServedRecords.forEach(
    (record: { date: Date; location: string; mealsServed: number }) => {
      const dateKey = `${record.date.toISOString()}-${record.location}`;
      actualMealsMap.set(dateKey, record.mealsServed);
    }
  );

  // For days without actual data, get default values from locations
  const locationsToFetch = Array.from(
    new Set(
      Array.from(uniqueDays.values())
        .filter(({ date, location }) => {
          const dateKey = `${toUTC(date).toISOString()}-${location}`;
          return !actualMealsMap.has(dateKey);
        })
        .map(({ location }) => location)
    )
  );

  const locationDefaults = await prisma.location.findMany({
    where: {
      name: { in: locationsToFetch },
    },
    select: {
      name: true,
      defaultMealsServed: true,
    },
  });

  const defaultsMap = new Map(
    locationDefaults.map(
      (loc: { name: string; defaultMealsServed: number }) => [
        loc.name,
        loc.defaultMealsServed,
      ]
    )
  );

  // Calculate total meals (actual + estimated)
  let totalMealsServed = 0;
  let hasAnyData = false;

  Array.from(uniqueDays.values()).forEach(({ date, location }) => {
    const dateKey = `${toUTC(date).toISOString()}-${location}`;

    if (actualMealsMap.has(dateKey)) {
      const meals = actualMealsMap.get(dateKey);
      if (typeof meals === "number") {
        totalMealsServed += meals;
        hasAnyData = true;
      }
    } else if (defaultsMap.has(location)) {
      const meals = defaultsMap.get(location);
      if (typeof meals === "number") {
        totalMealsServed += meals;
        hasAnyData = true;
      }
    }
  });

  // Fall back to old estimation only if no location data exists
  const estimatedMeals = totalHours * 15; // ~15 meals per hour
  const communityImpact = hasAnyData ? totalMealsServed : estimatedMeals;

  // Calculate shift type counts
  const shiftTypeCounts: Record<string, number> = {};
  completedShifts.forEach((signup: (typeof completedShifts)[0]) => {
    const shiftTypeId = signup.shift.shiftTypeId;
    if (shiftTypeId) {
      shiftTypeCounts[shiftTypeId] = (shiftTypeCounts[shiftTypeId] || 0) + 1;
    }
  });

  // Calculate consecutive months (simplified - volunteers who have at least one shift per month)
  const monthlyActivity = new Map<string, boolean>();
  completedShifts.forEach((signup: (typeof completedShifts)[0]) => {
    const monthKey = formatInNZT(signup.shift.start, "yyyy-MM");
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

      const prevDate = new Date(prevYear, prevMonth - 1);
      const currDate = new Date(currYear, currMonth - 1);
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

  // Calculate friends count (only ACCEPTED friendships)
  // Note: Friendships are stored bidirectionally, so we only count one direction
  // to avoid double-counting
  const friendsCount = await prisma.friendship.count({
    where: {
      userId,
      status: "ACCEPTED",
    },
  });

  return {
    shifts_completed: totalShifts,
    hours_volunteered: totalHours,
    consecutive_months: consecutiveMonths,
    years_volunteering: yearsVolunteering,
    community_impact: communityImpact,
    friends_count: friendsCount,
    shift_type_counts: shiftTypeCounts,
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
        case "friends_count":
          shouldUnlock = progress.friends_count >= criteria.value;
          break;
        case "specific_shift_type":
          // Use the already-calculated shift type counts from progress
          if (criteria.shiftType) {
            const specificShiftCount = progress.shift_type_counts[criteria.shiftType] || 0;
            shouldUnlock = specificShiftCount >= criteria.value;
          }
          break;
      }

      if (shouldUnlock) {
        // Get the progress value to store
        let progressValue = 0;
        if (criteria.type === "specific_shift_type" && criteria.shiftType) {
          progressValue = progress.shift_type_counts[criteria.shiftType] || 0;
        } else {
          const progressField = progress[criteria.type as keyof UserProgress];
          progressValue = typeof progressField === "number" ? progressField : 0;
        }

        await prisma.userAchievement.create({
          data: {
            userId,
            achievementId: achievement.id,
            progress: progressValue,
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
