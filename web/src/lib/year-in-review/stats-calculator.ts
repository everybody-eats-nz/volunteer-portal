import { prisma } from "@/lib/prisma";
import { differenceInHours, format } from "date-fns";
import { toNZT, formatInNZT } from "@/lib/timezone";
import { calculateUserProgress } from "@/lib/achievements";

export interface YearStats {
  year: number;
  userId: string;
  userName: string;

  // Primary stats
  totalShifts: number;
  totalHours: number;
  mealsServed: number;
  volunteerDays: number;

  // Impact metrics
  locationsVisited: string[];
  favoriteShiftType: { name: string; count: number } | null;
  busiestMonth: { month: string; count: number } | null;
  foodWasteKg: number;

  // Community metrics
  achievementsUnlocked: number;
  volunteerGrade: string;
  friendsMade: number;
  currentStreak: number;

  // Highlights
  firstShift: { date: string; type: string; location: string } | null;
  lastShift: { date: string; type: string; location: string } | null;
  longestShift: { duration: number; date: string; type: string } | null;

  // Profile
  profilePhotoUrl: string | null;
}

/**
 * Calculate comprehensive year-in-review statistics for a user
 * Returns null if user has no shifts in the specified year
 */
export async function calculateYearStats(
  userId: string,
  year: number
): Promise<YearStats | null> {
  // Date range in NZ timezone
  const startDate = new Date(year, 0, 1); // Jan 1
  const endDate = new Date(year, 11, 31, 23, 59, 59); // Dec 31

  // Parallel queries for performance
  const [user, completedShifts, achievementsUnlocked, friendships] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          firstName: true,
          lastName: true,
          volunteerGrade: true,
          profilePhotoUrl: true,
          createdAt: true,
        },
      }),

      prisma.signup.findMany({
        where: {
          userId,
          status: "CONFIRMED",
          shift: {
            start: { gte: startDate },
            end: { lte: endDate },
          },
        },
        include: {
          shift: {
            include: { shiftType: true },
          },
        },
        orderBy: { shift: { start: "asc" } },
      }),

      prisma.userAchievement.count({
        where: {
          userId,
          unlockedAt: { gte: startDate, lte: endDate },
        },
      }),

      prisma.friendship.count({
        where: {
          OR: [
            { userId, createdAt: { gte: startDate, lte: endDate } },
            { friendId: userId, createdAt: { gte: startDate, lte: endDate } },
          ],
          status: "ACCEPTED",
        },
      }),
    ]);

  if (!user) {
    throw new Error("User not found");
  }

  // Return null if no shifts (feature should be hidden for this year)
  if (completedShifts.length === 0) {
    return null;
  }

  // Calculate primary metrics
  const totalShifts = completedShifts.length;
  const totalHours = completedShifts.reduce(
    (sum, signup) =>
      sum + differenceInHours(signup.shift.end, signup.shift.start),
    0
  );
  const mealsServed = totalHours * 15; // Standard calculation: ~15 meals per hour
  const foodWasteKg = Math.round(mealsServed * 0.4); // Estimate: 400g per meal saved

  // Calculate volunteer days (unique dates)
  const uniqueDates = new Set(
    completedShifts.map((s) => format(toNZT(s.shift.start), "yyyy-MM-dd"))
  );
  const volunteerDays = uniqueDates.size;

  // Calculate locations visited
  const locations = new Set(
    completedShifts
      .map((s) => s.shift.location)
      .filter((location): location is string => Boolean(location))
  );
  const locationsVisited = Array.from(locations);

  // Calculate favorite shift type
  const shiftTypeCounts = new Map<string, number>();
  completedShifts.forEach((signup) => {
    const type = signup.shift.shiftType.name;
    shiftTypeCounts.set(type, (shiftTypeCounts.get(type) || 0) + 1);
  });

  const favoriteShiftTypeEntry = Array.from(shiftTypeCounts.entries()).sort(
    (a, b) => b[1] - a[1]
  )[0];
  const favoriteShiftType = favoriteShiftTypeEntry
    ? {
        name: favoriteShiftTypeEntry[0],
        count: favoriteShiftTypeEntry[1],
      }
    : null;

  // Calculate busiest month
  const monthCounts = new Map<string, number>();
  completedShifts.forEach((signup) => {
    const month = format(toNZT(signup.shift.start), "MMMM");
    monthCounts.set(month, (monthCounts.get(month) || 0) + 1);
  });

  const busiestMonthEntry = Array.from(monthCounts.entries()).sort(
    (a, b) => b[1] - a[1]
  )[0];
  const busiestMonth = busiestMonthEntry
    ? {
        month: busiestMonthEntry[0],
        count: busiestMonthEntry[1],
      }
    : null;

  // Calculate highlights
  const firstShift = completedShifts[0];
  const lastShift = completedShifts[completedShifts.length - 1];

  const longestShiftData = completedShifts.reduce(
    (longest, signup) => {
      const duration = differenceInHours(signup.shift.end, signup.shift.start);
      if (!longest || duration > longest.duration) {
        return { duration, signup };
      }
      return longest;
    },
    null as { duration: number; signup: (typeof completedShifts)[0] } | null
  );

  // Get current streak (from existing achievements logic)
  const progress = await calculateUserProgress(userId);

  // Format user name
  const userName = user.name || `${user.firstName} ${user.lastName}`.trim() || "Volunteer";

  return {
    year,
    userId,
    userName,

    // Primary stats
    totalShifts,
    totalHours,
    mealsServed,
    volunteerDays,

    // Impact metrics
    locationsVisited,
    favoriteShiftType,
    busiestMonth,
    foodWasteKg,

    // Community metrics
    achievementsUnlocked,
    volunteerGrade: user.volunteerGrade,
    friendsMade: friendships,
    currentStreak: progress.consecutive_months,

    // Highlights
    firstShift: firstShift
      ? {
          date: formatInNZT(firstShift.shift.start, "MMMM d"),
          type: firstShift.shift.shiftType.name,
          location: firstShift.shift.location || "Unknown",
        }
      : null,
    lastShift: lastShift
      ? {
          date: formatInNZT(lastShift.shift.start, "MMMM d"),
          type: lastShift.shift.shiftType.name,
          location: lastShift.shift.location || "Unknown",
        }
      : null,
    longestShift: longestShiftData
      ? {
          duration: longestShiftData.duration,
          date: formatInNZT(longestShiftData.signup.shift.start, "MMMM d"),
          type: longestShiftData.signup.shift.shiftType.name,
        }
      : null,

    // Profile
    profilePhotoUrl: user.profilePhotoUrl,
  };
}

/**
 * Get a quick summary of available years with activity for a user
 * Useful for UI to show year selector options
 */
export async function getYearsSummary(userId: string): Promise<
  Array<{
    year: number;
    shiftCount: number;
    hasActivity: boolean;
  }>
> {
  const currentYear = new Date().getFullYear();
  const years = [];

  // Check last 3 years
  for (let i = 0; i <= 2; i++) {
    const year = currentYear - i;
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    const shiftCount = await prisma.signup.count({
      where: {
        userId,
        status: "CONFIRMED",
        shift: {
          start: { gte: startDate },
          end: { lte: endDate },
        },
      },
    });

    years.push({
      year,
      shiftCount,
      hasActivity: shiftCount > 0,
    });
  }

  return years.filter((y) => y.hasActivity);
}
