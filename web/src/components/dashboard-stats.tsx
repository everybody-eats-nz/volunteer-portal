import { prisma } from "@/lib/prisma";
import { displayHours, totalShiftHours } from "@/lib/volunteer-hours";
import { StatBand } from "@/components/ui/stat-band";

interface DashboardStatsProps {
  userId: string;
}

export async function DashboardStats({ userId }: DashboardStatsProps) {
  const now = new Date();

  // Get comprehensive user statistics
  const [completedShifts, upcomingShifts, pendingShifts, monthlyShifts, user] =
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

      // Get user's shift count adjustment
      prisma.user.findUnique({
        where: { id: userId },
        select: { completedShiftAdjustment: true },
      }),
    ]);

  // Calculate total hours volunteered
  const totalHours = displayHours(
    totalShiftHours(completedShifts.map((signup) => signup.shift))
  );

  const shiftAdjustment = user?.completedShiftAdjustment || 0;
  const adjustedCompletedShifts = completedShifts.length + shiftAdjustment;

  return (
    <StatBand
      testId="dashboard-stats"
      stats={[
        {
          label: "Shifts Completed",
          value: adjustedCompletedShifts,
          testId: "dashboard-completed-card",
        },
        {
          label: "Hours Contributed",
          value: totalHours,
          testId: "dashboard-hours-card",
        },
        {
          label: "Confirmed Shifts",
          value: upcomingShifts,
          subtitle:
            pendingShifts > 0
              ? `+${pendingShifts} pending approval`
              : undefined,
          testId: "dashboard-confirmed-card",
        },
        {
          label: "Shifts This Month",
          value: monthlyShifts,
          testId: "dashboard-month-card",
        },
      ]}
    />
  );
}
