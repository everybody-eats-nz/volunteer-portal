import { prisma } from "@/lib/prisma";
import { differenceInHours, startOfDay } from "date-fns";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MotionContentCard } from "@/components/motion-content-card";
import { CheckCircle } from "lucide-react";
import { toUTC, toNZT } from "@/lib/timezone";

interface DashboardImpactStatsProps {
  userId: string;
}

export async function DashboardImpactStats({
  userId,
}: DashboardImpactStatsProps) {
  const now = new Date();

  // Get completed shifts and community stats
  const [completedShifts, totalVolunteers] = await Promise.all([
    prisma.signup.findMany({
      where: {
        userId,
        shift: { end: { lt: now } },
        status: "CONFIRMED",
      },
      include: { shift: { include: { shiftType: true } } },
    }),

    prisma.user.count({
      where: { role: "VOLUNTEER" },
    }),
  ]);

  // Calculate total hours volunteered
  const totalHours = completedShifts.reduce((total, signup) => {
    const hours = differenceInHours(signup.shift.end, signup.shift.start);
    return total + hours;
  }, 0);

  // Get user's favorite shift type
  const shiftTypeCounts = completedShifts.reduce((acc, signup) => {
    const typeName = signup.shift.shiftType.name;
    acc[typeName] = (acc[typeName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const favoriteShiftType = Object.entries(shiftTypeCounts).sort(
    ([, a], [, b]) => (b as number) - (a as number)
  )[0]?.[0];

  // Calculate total meals served for shifts this volunteer worked
  // Group shifts by date and location to get unique days
  const uniqueDays = new Map<string, { date: Date; location: string }>();
  completedShifts.forEach((signup) => {
    const shiftDate = signup.shift.start;
    const location = signup.shift.location || "Unknown";
    // Convert to NZ timezone first, then get start of day in NZ
    const shiftDateNZT = toNZT(shiftDate);
    const startOfDayNZT = startOfDay(shiftDateNZT);
    const dateKey = `${startOfDayNZT.toISOString()}-${location}`;

    if (!uniqueDays.has(dateKey)) {
      uniqueDays.set(dateKey, {
        date: startOfDayNZT,
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
  let daysWithActualData = 0;
  let daysWithEstimatedData = 0;

  Array.from(uniqueDays.values()).forEach(({ date, location }) => {
    const dateKey = `${toUTC(date).toISOString()}-${location}`;

    if (actualMealsMap.has(dateKey)) {
      const meals = actualMealsMap.get(dateKey);
      if (typeof meals === "number") {
        totalMealsServed += meals;
        daysWithActualData++;
      }
    } else if (defaultsMap.has(location)) {
      const meals = defaultsMap.get(location);
      if (typeof meals === "number") {
        totalMealsServed += meals;
        daysWithEstimatedData++;
      }
    }
  });
  const hasAnyData = daysWithActualData > 0 || daysWithEstimatedData > 0;
  const hasActualData = daysWithActualData > 0;

  // Fall back to old estimation only if no location data exists
  const estimatedMeals = totalHours * 15;
  const mealsToDisplay = hasAnyData ? totalMealsServed : estimatedMeals;

  return (
    <MotionContentCard className="h-fit" delay={0.6}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-primary dark:text-emerald-400" />
          Your Impact & Community
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary dark:text-emerald-400 mb-2">
                {hasAnyData ? "" : "~"}{mealsToDisplay.toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground">
                {hasAnyData ? "People served" : "Estimated people served"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {hasActualData && daysWithEstimatedData > 0
                  ? `${daysWithActualData} shift${daysWithActualData !== 1 ? "s" : ""} with actual data, ${daysWithEstimatedData} estimated`
                  : hasActualData
                  ? `Across ${daysWithActualData} shift${daysWithActualData !== 1 ? "s" : ""} you completed`
                  : hasAnyData
                  ? `Based on ${daysWithEstimatedData} shift${daysWithEstimatedData !== 1 ? "s" : ""} you completed`
                  : "Based on ~15 meals per volunteer hour"}
              </p>
            </div>

            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mb-2">
                {totalVolunteers.toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground">
                Active volunteers in our community
              </p>
              {favoriteShiftType && (
                <p className="text-xs text-muted-foreground mt-1">
                  Your specialty: {favoriteShiftType}
                </p>
              )}
            </div>

            {/* <div className="text-center">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
                {(Math.round(totalHours * 2.5 * 10) / 10).toLocaleString()}kg
              </div>
              <p className="text-sm text-muted-foreground">
                Estimated food waste prevented
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Based on rescue food operations
              </p>
            </div> */}
          </div>
        </div>
      </CardContent>
    </MotionContentCard>
  );
}
