import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const location = searchParams.get("location");

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "startDate and endDate are required" },
      { status: 400 }
    );
  }

  try {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Calculate number of days in range
    const daysInRange =
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Build where clause
    const where: any = {
      date: {
        gte: start,
        lte: end,
      },
    };

    if (location && location !== "all") {
      where.location = location;
    }

    // Fetch location defaults
    const locations = await prisma.location.findMany({
      where: {
        isActive: true,
        ...(location && location !== "all" ? { name: location } : {}),
      },
      select: {
        name: true,
        defaultMealsServed: true,
      },
    });

    const locationDefaults: Record<string, number> = {};
    locations.forEach((loc) => {
      locationDefaults[loc.name] = loc.defaultMealsServed;
    });

    // Fetch all shifts in the date range to know which days had operations
    const shifts = await prisma.shift.findMany({
      where: {
        start: {
          gte: start,
          lte: end,
        },
        ...(location && location !== "all" ? { location } : {}),
      },
      select: {
        start: true,
        location: true,
      },
    });

    // Get unique date/location combinations from shifts
    const daysWithShifts = new Set<string>();
    const locationDays: Record<string, Set<string>> = {};

    shifts.forEach((shift) => {
      const dateKey = new Date(shift.start).toISOString().substring(0, 10);
      const loc = shift.location || "Unknown";
      const dayLocationKey = `${dateKey}|${loc}`;

      daysWithShifts.add(dayLocationKey);

      if (!locationDays[loc]) {
        locationDays[loc] = new Set();
      }
      locationDays[loc].add(dateKey);
    });

    // Fetch meals served records
    const mealsServedRecords = await prisma.mealsServed.findMany({
      where,
      orderBy: {
        date: "asc",
      },
    });

    // Create a map of recorded meals by date/location
    const recordedMeals = new Map<string, number>();
    mealsServedRecords.forEach((record) => {
      const dateKey = new Date(record.date).toISOString().substring(0, 10);
      const key = `${dateKey}|${record.location}`;
      recordedMeals.set(key, record.mealsServed);
    });

    // Calculate totals by location
    const totalsByLocation: Record<
      string,
      {
        total: number;
        records: number;
        daysWithShifts: number;
        average: number;
        expected: number;
        defaultMealsPerDay: number;
        variance: number;
        percentOfTarget: number;
      }
    > = {};

    // Initialize with location defaults and count days with shifts
    Object.keys(locationDefaults).forEach((loc) => {
      totalsByLocation[loc] = {
        total: 0,
        records: 0,
        daysWithShifts: locationDays[loc]?.size || 0,
        average: 0,
        expected: 0,
        defaultMealsPerDay: locationDefaults[loc],
        variance: 0,
        percentOfTarget: 0,
      };
    });

    // For each day with shifts, count actual or default meals
    Object.keys(locationDays).forEach((loc) => {
      if (!totalsByLocation[loc]) {
        totalsByLocation[loc] = {
          total: 0,
          records: 0,
          daysWithShifts: locationDays[loc].size,
          average: 0,
          expected: 0,
          defaultMealsPerDay: locationDefaults[loc] || 60,
          variance: 0,
          percentOfTarget: 0,
        };
      }

      const defaultMeals = locationDefaults[loc] || 60;

      locationDays[loc].forEach((dateKey) => {
        const key = `${dateKey}|${loc}`;
        const actualMeals = recordedMeals.get(key);

        if (actualMeals !== undefined) {
          // Use actual recorded meals
          totalsByLocation[loc].total += actualMeals;
          totalsByLocation[loc].records += 1;
        } else {
          // No record, use default meals
          totalsByLocation[loc].total += defaultMeals;
        }
      });
    });

    // Calculate expected (always based on days with shifts × default), averages and variances
    Object.keys(totalsByLocation).forEach((loc) => {
      const data = totalsByLocation[loc];
      // Expected = default meals per day × number of days with shifts
      data.expected = data.defaultMealsPerDay * data.daysWithShifts;
      data.average =
        data.daysWithShifts > 0 ? Math.round(data.total / data.daysWithShifts) : 0;
      data.variance = data.total - data.expected;
      data.percentOfTarget =
        data.expected > 0 ? Math.round((data.total / data.expected) * 100) : 0;
    });

    // Calculate grand total
    const grandTotal = Object.values(totalsByLocation).reduce(
      (sum, data) => sum + data.total,
      0
    );

    // Group by date for daily trends chart (including default values)
    const dailyTrends: Record<string, Record<string, number>> = {};

    // For each location with shifts, add data for each day
    Object.keys(locationDays).forEach((loc) => {
      const defaultMeals = locationDefaults[loc] || 60;

      locationDays[loc].forEach((dateKey) => {
        if (!dailyTrends[dateKey]) {
          dailyTrends[dateKey] = {};
        }

        const key = `${dateKey}|${loc}`;
        const actualMeals = recordedMeals.get(key);

        // Use actual if available, otherwise use default
        dailyTrends[dateKey][loc] = actualMeals !== undefined ? actualMeals : defaultMeals;
      });
    });

    // Convert to array format for chart
    const chartData = Object.keys(dailyTrends)
      .sort()
      .map((date) => ({
        date,
        ...dailyTrends[date],
      }));

    // Group by location and month for trends
    const monthlyTrends: Record<
      string,
      Record<string, { total: number; count: number }>
    > = {};

    mealsServedRecords.forEach((record) => {
      const monthKey = new Date(record.date).toISOString().substring(0, 7); // YYYY-MM

      if (!monthlyTrends[record.location]) {
        monthlyTrends[record.location] = {};
      }

      if (!monthlyTrends[record.location][monthKey]) {
        monthlyTrends[record.location][monthKey] = { total: 0, count: 0 };
      }

      monthlyTrends[record.location][monthKey].total += record.mealsServed;
      monthlyTrends[record.location][monthKey].count += 1;
    });

    // Calculate grand totals
    const grandExpected = Object.values(totalsByLocation).reduce(
      (sum, data) => sum + data.expected,
      0
    );
    const grandVariance = grandTotal - grandExpected;
    const grandPercentOfTarget =
      grandExpected > 0 ? Math.round((grandTotal / grandExpected) * 100) : 0;

    return NextResponse.json({
      totalsByLocation,
      grandTotal,
      grandExpected,
      grandVariance,
      grandPercentOfTarget,
      daysInRange,
      chartData,
      monthlyTrends,
      recordCount: mealsServedRecords.length,
    });
  } catch (error) {
    console.error("Error fetching meals served analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics data" },
      { status: 500 }
    );
  }
}
