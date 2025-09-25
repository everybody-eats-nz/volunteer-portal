import { prisma } from "@/lib/prisma";
import { differenceInHours } from "date-fns";
import { AnimatedStatsGrid } from "@/components/animated-stats-grid";

interface DashboardStatsProps {
  userId: string;
}

export async function DashboardStats({ userId }: DashboardStatsProps) {
  const now = new Date();

  // Get comprehensive user statistics
  const [completedShifts, upcomingShifts, pendingShifts, monthlyShifts] =
    await Promise.all([
      // Completed shifts (past shifts with CONFIRMED status)
      prisma.signup.findMany({
        where: {
          userId: userId,
          shift: { end: { lt: now } },
          status: "CONFIRMED",
        },
        include: { shift: { include: { shiftType: true } } },
      }),

      // Upcoming confirmed shifts count
      prisma.signup.count({
        where: {
          userId: userId,
          shift: { start: { gte: now } },
          status: "CONFIRMED",
        },
      }),

      // Pending approval shifts count
      prisma.signup.count({
        where: {
          userId: userId,
          shift: { start: { gte: now } },
          status: "PENDING",
        },
      }),

      // This month's shifts for the user
      prisma.signup.count({
        where: {
          userId: userId,
          status: "CONFIRMED",
          shift: {
            start: {
              gte: new Date(now.getFullYear(), now.getMonth(), 1),
              lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
            },
          },
        },
      }),
    ]);

  // Calculate total hours volunteered
  const totalHours = completedShifts.reduce((total, signup) => {
    const hours = differenceInHours(signup.shift.end, signup.shift.start);
    return total + hours;
  }, 0);

  return (
    <AnimatedStatsGrid
      stats={[
        {
          title: "Shifts Completed",
          value: completedShifts.length,
          iconType: "checkCircle",
          variant: "green",
        },
        {
          title: "Hours Contributed",
          value: totalHours,
          iconType: "clock",
          variant: "amber",
        },
        {
          title: "Confirmed Shifts",
          value: upcomingShifts,
          subtitle:
            pendingShifts > 0
              ? `+${pendingShifts} pending approval`
              : undefined,
          iconType: "calendar",
          variant: "blue",
        },
        {
          title: "This Month",
          value: monthlyShifts,
          iconType: "trendingUp",
          variant: "purple",
        },
      ]}
    />
  );
}
