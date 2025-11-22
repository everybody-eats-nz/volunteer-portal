import { prisma } from "@/lib/prisma";
import { differenceInHours, startOfDay } from "date-fns";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MotionContentCard } from "@/components/motion-content-card";
import { CheckCircle } from "lucide-react";
import { toUTC } from "@/lib/timezone";

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

  // Calculate total meals from actual records, with fallback to estimate
  const totalMealsServed = mealsServedRecords.reduce(
    (sum, record) => sum + record.mealsServed,
    0
  );

  // Count days with actual data vs estimated
  const daysWithActualData = mealsServedRecords.length;
  const totalDays = uniqueDays.size;

  // If we have some actual data, use it; otherwise fall back to estimation
  const estimatedMeals = totalHours * 15; // Old calculation as fallback
  const mealsToDisplay =
    daysWithActualData > 0 ? totalMealsServed : estimatedMeals;

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary dark:text-emerald-400 mb-2">
                {mealsToDisplay}
              </div>
              <p className="text-sm text-muted-foreground">
                {daysWithActualData > 0
                  ? "Meals helped prepare"
                  : "Estimated meals helped prepare"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {daysWithActualData > 0 ? (
                  <>
                    Based on {daysWithActualData} day
                    {daysWithActualData !== 1 ? "s" : ""} of actual data
                    {totalDays > daysWithActualData &&
                      ` (${totalDays - daysWithActualData} days estimated)`}
                  </>
                ) : (
                  "Based on ~15 meals per volunteer hour"
                )}
              </p>
            </div>

            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mb-2">
                {totalVolunteers}
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

            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
                {Math.round(totalHours * 2.5 * 10) / 10}kg
              </div>
              <p className="text-sm text-muted-foreground">
                Estimated food waste prevented
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Based on rescue food operations
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </MotionContentCard>
  );
}
