import { toNZT } from "@/lib/timezone";
import { prisma } from "@/lib/prisma";

/**
 * Check if Year in Review feature is available
 * Available during December 1 - January 31 in NZ timezone
 */
export function isSeasonallyAvailable(): boolean {
  const now = toNZT(new Date());
  const month = now.getMonth(); // 0-indexed (0 = Jan, 11 = Dec)

  // December (11) or January (0)
  return month === 11 || month === 0;
}

/**
 * Get message for when feature is not available
 */
export function getUnavailableMessage(): string {
  const now = toNZT(new Date());
  const currentMonth = now.getMonth();

  if (currentMonth === 1) {
    // February - just missed it
    return "Year in Review is only available in December and January. Check back next December!";
  } else {
    const monthsUntilDecember = 11 - currentMonth;
    return `Year in Review will be available in ${monthsUntilDecember} month${monthsUntilDecember > 1 ? "s" : ""} (December 1st).`;
  }
}

/**
 * Get available years for review for a specific user
 * Only returns years where the user has confirmed shifts
 * Current year only available in December/January
 * Previous years always available during the season
 * Limited to last 3 years
 */
export async function getAvailableYears(userId: string): Promise<number[]> {
  const now = toNZT(new Date());
  const currentYear = now.getFullYear();
  const month = now.getMonth();

  // Get years with at least one confirmed shift
  const shiftsWithYears = await prisma.signup.findMany({
    where: {
      userId,
      status: "CONFIRMED",
    },
    select: {
      shift: {
        select: {
          start: true,
        },
      },
    },
  });

  // Extract unique years from shifts
  const yearsWithActivity = new Set<number>();
  shiftsWithYears.forEach((signup) => {
    const shiftYear = toNZT(signup.shift.start).getFullYear();
    yearsWithActivity.add(shiftYear);
  });

  // Filter to years we want to show
  const availableYears: number[] = [];

  // In December: Can review current year
  // In January: Can review previous year (which just ended)
  if (month === 11 && yearsWithActivity.has(currentYear)) {
    availableYears.push(currentYear);
  } else if (month === 0 && yearsWithActivity.has(currentYear - 1)) {
    availableYears.push(currentYear - 1);
  }

  // Also include previous years (limit to last 3 years total)
  for (let i = 1; i <= 3; i++) {
    const year = currentYear - i;
    if (year >= 2020 && yearsWithActivity.has(year) && !availableYears.includes(year)) {
      availableYears.push(year);
    }
  }

  return availableYears.sort((a, b) => b - a); // Descending order
}

/**
 * Check if a user has any shifts in a specific year
 * Used to determine if we should show the year-in-review feature
 */
export async function hasShiftsInYear(userId: string, year: number): Promise<boolean> {
  const startDate = new Date(year, 0, 1); // Jan 1
  const endDate = new Date(year, 11, 31, 23, 59, 59); // Dec 31

  const count = await prisma.signup.count({
    where: {
      userId,
      status: "CONFIRMED",
      shift: {
        start: {
          gte: startDate,
          lte: endDate,
        },
      },
    },
  });

  return count > 0;
}
