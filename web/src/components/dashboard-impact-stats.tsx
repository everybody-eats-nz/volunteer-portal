import { prisma } from "@/lib/prisma";
import { differenceInHours } from "date-fns";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MotionContentCard } from "@/components/motion-content-card";
import { CheckCircle } from "lucide-react";

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
                {totalHours * 15}
              </div>
              <p className="text-sm text-muted-foreground">
                Estimated meals helped prepare
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Based on ~15 meals per volunteer hour
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
