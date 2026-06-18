import { prisma } from "@/lib/prisma";
import { formatInNZT, getStartOfDayUTC } from "@/lib/timezone";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MotionContentCard } from "@/components/motion-content-card";
import { CheckCircle, Clock, Utensils, History } from "lucide-react";
import Link from "next/link";

interface DashboardRecentActivityProps {
  userId: string;
}

export async function DashboardRecentActivity({ userId }: DashboardRecentActivityProps) {
  const now = new Date();

  // Recent completed shifts (last 3)
  const recentShifts = await prisma.signup.findMany({
    where: {
      userId: userId,
      shift: { end: { lt: now } },
      status: "CONFIRMED",
    },
    include: { shift: { include: { shiftType: true } } },
    orderBy: { shift: { start: "desc" } },
    take: 3,
  });

  // Fetch meals served data for these shifts
  const mealsServedPromises = recentShifts.map(async (signup) => {
    if (!signup.shift.location) return { actual: null, default: null };

    const shiftDateUTC = getStartOfDayUTC(signup.shift.start);

    // Get actual meals served
    const actualMeals = await prisma.mealsServed.findUnique({
      where: {
        date_location: {
          date: shiftDateUTC,
          location: signup.shift.location,
        },
      },
    });

    // If no actual data, get the location's default
    let defaultMeals = null;
    if (!actualMeals) {
      const locationData = await prisma.location.findUnique({
        where: { name: signup.shift.location },
        select: { defaultMealsServed: true },
      });
      defaultMeals = locationData?.defaultMealsServed;
    }

    return { actual: actualMeals, default: defaultMeals };
  });

  const mealsServedData = await Promise.all(mealsServedPromises);

  // Combine shifts with their meals served data
  const shiftsWithMeals = recentShifts.map((shift, index) => ({
    ...shift,
    mealsServed: mealsServedData[index].actual,
    defaultMealsServed: mealsServedData[index].default,
  }));

  return (
    <MotionContentCard
      className="grain relative h-fit flex-1 min-w-80 overflow-hidden rounded-3xl border-forest-500/10 dark:border-cream-50/10"
      delay={0.3}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-forest-500 to-forest-300 dark:from-forest-400 dark:to-forest-300" />
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest-500/10 text-forest-600 ring-1 ring-forest-500/10 dark:bg-cream-50/10 dark:text-cream-50/80 dark:ring-cream-50/10">
            <History className="h-5 w-5" />
          </span>
          <span className="display text-xl tracking-tight text-forest-700 dark:text-cream-50">
            Recent Activity
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {shiftsWithMeals.length > 0 ? (
          <div className="space-y-3">
            {shiftsWithMeals.map((signup) => (
              <div
                key={signup.id}
                className="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-forest-500/5 dark:hover:bg-cream-50/5"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest-500/10 text-forest-600 ring-1 ring-forest-500/10 dark:bg-cream-50/10 dark:text-cream-50/80 dark:ring-cream-50/10">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-forest-700 dark:text-cream-50">
                    {signup.shift.shiftType.name}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-forest-700/60 dark:text-cream-50/55">
                    <span>
                      {formatInNZT(signup.shift.start, "MMM d")} •{" "}
                      {signup.shift.location}
                    </span>
                    {(signup.mealsServed || signup.defaultMealsServed) && (
                      <>
                        <span>•</span>
                        <span className={`flex items-center gap-1 font-medium ${signup.mealsServed ? "text-forest-600 dark:text-cream-50/80" : "text-forest-700/55 dark:text-cream-50/50"}`}>
                          <Utensils className="h-3 w-3" />
                          {signup.mealsServed ? "" : "~"}{signup.mealsServed?.mealsServed || signup.defaultMealsServed}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="border-forest-500/20 text-xs text-forest-700 dark:border-cream-50/20 dark:text-cream-50/85"
                >
                  Completed
                </Badge>
              </div>
            ))}
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href="/shifts/mine">View All History</Link>
            </Button>
          </div>
        ) : (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-forest-500/10 text-forest-600 ring-1 ring-forest-500/10 dark:bg-cream-50/10 dark:text-cream-50/80 dark:ring-cream-50/10">
              <Clock className="h-8 w-8" />
            </div>
            <h3 className="display text-lg tracking-tight text-forest-700 dark:text-cream-50">
              No completed shifts yet
            </h3>
            <p className="mx-auto mt-2 max-w-xs text-sm text-forest-700/70 dark:text-cream-50/65">
              Your completed shifts will appear here after you volunteer.
            </p>
          </div>
        )}
      </CardContent>
    </MotionContentCard>
  );
}