import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { addDays, differenceInHours, format, startOfMonth } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const location = searchParams.get("location") || "all";
    const startDate = searchParams.get("startDate")
      ? new Date(searchParams.get("startDate")!)
      : addDays(new Date(), -30);
    const endDate = searchParams.get("endDate")
      ? new Date(searchParams.get("endDate")!)
      : new Date();

    // Build location filter
    const locationFilter =
      location && location !== "all" ? { location } : {};

    // Fetch meals served data
    const mealsData = await prisma.mealsServed.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        ...locationFilter,
      },
      orderBy: { date: "asc" },
    });

    const totalMealsServed = mealsData.reduce(
      (sum, record) => sum + record.mealsServed,
      0
    );

    const mealsTrend = mealsData.map((record) => ({
      date: format(record.date, "yyyy-MM-dd"),
      location: record.location,
      mealsServed: record.mealsServed,
    }));

    // Fetch completed shifts for hours calculation
    const completedShifts = await prisma.signup.findMany({
      where: {
        status: "CONFIRMED",
        shift: {
          end: { gte: startDate, lte: endDate },
          ...locationFilter,
        },
      },
      select: {
        userId: true,
        shift: {
          select: {
            start: true,
            end: true,
            location: true,
          },
        },
      },
    });

    // Calculate total hours
    const totalHoursVolunteered = completedShifts.reduce((sum, signup) => {
      const hours = differenceInHours(
        signup.shift.end,
        signup.shift.start
      );
      return sum + Math.max(hours, 0);
    }, 0);

    // Get unique volunteers
    const uniqueVolunteers = new Set(completedShifts.map((s) => s.userId));
    const averageHoursPerVolunteer =
      uniqueVolunteers.size > 0
        ? Math.round(totalHoursVolunteered / uniqueVolunteers.size)
        : 0;

    const impactMetrics = {
      totalMealsServed,
      totalHoursVolunteered,
      averageHoursPerVolunteer,
      totalShiftsCompleted: completedShifts.length,
    };

    // Capacity utilization
    const shifts = await prisma.shift.findMany({
      where: {
        start: { gte: startDate },
        end: { lte: endDate },
        ...locationFilter,
      },
      select: {
        id: true,
        capacity: true,
        location: true,
        signups: {
          where: {
            status: { in: ["CONFIRMED", "WAITLISTED"] },
          },
        },
      },
    });

    let underutilizedCount = 0;
    let fullCount = 0;
    let oversubscribedCount = 0;
    let totalFillRate = 0;

    shifts.forEach((shift) => {
      const confirmedCount = shift.signups.filter(
        (s) => s.status === "CONFIRMED"
      ).length;
      const waitlistedCount = shift.signups.filter(
        (s) => s.status === "WAITLISTED"
      ).length;

      const fillRate = shift.capacity > 0 ? confirmedCount / shift.capacity : 0;
      totalFillRate += fillRate;

      if (fillRate < 0.5) underutilizedCount++;
      if (fillRate >= 1) fullCount++;
      if (waitlistedCount > 0) oversubscribedCount++;
    });

    const averageFillRate =
      shifts.length > 0
        ? Math.round((totalFillRate / shifts.length) * 100)
        : 0;

    const capacityUtilization = {
      averageFillRate,
      underutilizedShifts: underutilizedCount,
      fullShifts: fullCount,
      oversubscribed: oversubscribedCount,
    };

    // Location comparison (if "all" is selected)
    let locationComparison: Array<{
      location: string;
      mealsServed: number;
      volunteersActive: number;
      averageFillRate: number;
      shiftsCompleted: number;
    }> = [];

    if (location === "all") {
      const locations = ["Wellington", "Glen Innes", "Onehunga"];

      locationComparison = await Promise.all(
        locations.map(async (loc) => {
          const [locMeals, locShifts, locSignups] = await Promise.all([
            prisma.mealsServed.aggregate({
              where: {
                location: loc,
                date: { gte: startDate, lte: endDate },
              },
              _sum: { mealsServed: true },
            }),
            prisma.shift.findMany({
              where: {
                location: loc,
                start: { gte: startDate },
                end: { lte: endDate },
              },
              select: {
                capacity: true,
                signups: {
                  where: { status: "CONFIRMED" },
                },
              },
            }),
            prisma.signup.findMany({
              where: {
                status: "CONFIRMED",
                shift: {
                  location: loc,
                  end: { gte: startDate, lte: endDate },
                },
              },
              distinct: ["userId"],
              select: { userId: true },
            }),
          ]);

          let locFillRateSum = 0;
          locShifts.forEach((shift) => {
            const confirmedCount = shift.signups.length;
            const fillRate =
              shift.capacity > 0 ? confirmedCount / shift.capacity : 0;
            locFillRateSum += fillRate;
          });

          const locAvgFillRate =
            locShifts.length > 0
              ? Math.round((locFillRateSum / locShifts.length) * 100)
              : 0;

          return {
            location: loc,
            mealsServed: locMeals._sum.mealsServed || 0,
            volunteersActive: locSignups.length,
            averageFillRate: locAvgFillRate,
            shiftsCompleted: locShifts.length,
          };
        })
      );
    }

    // Hours trend by month
    const hoursMap = new Map<
      string,
      { totalHours: number; volunteerIds: Set<string> }
    >();

    completedShifts.forEach((signup) => {
      const monthKey = format(startOfMonth(signup.shift.start), "yyyy-MM");
      const hours = Math.max(
        differenceInHours(signup.shift.end, signup.shift.start),
        0
      );

      if (!hoursMap.has(monthKey)) {
        hoursMap.set(monthKey, {
          totalHours: 0,
          volunteerIds: new Set(),
        });
      }

      const monthData = hoursMap.get(monthKey)!;
      monthData.totalHours += hours;
      monthData.volunteerIds.add(signup.userId);
    });

    const hoursTrend = Array.from(hoursMap.entries())
      .map(([month, data]) => ({
        month,
        totalHours: data.totalHours,
        averagePerVolunteer:
          data.volunteerIds.size > 0
            ? Math.round(data.totalHours / data.volunteerIds.size)
            : 0,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return NextResponse.json({
      impactMetrics,
      mealsTrend,
      capacityUtilization,
      locationComparison,
      hoursTrend,
    });
  } catch (error) {
    console.error("Error fetching impact analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch impact analytics" },
      { status: 500 }
    );
  }
}
