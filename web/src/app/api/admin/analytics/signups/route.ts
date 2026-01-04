import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { addDays, format, startOfDay } from "date-fns";

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
    const shiftTypeId = searchParams.get("shiftTypeId");

    // Build filters
    const locationFilter =
      location && location !== "all" ? { shift: { location } } : {};
    const shiftTypeFilter = shiftTypeId
      ? { shift: { shiftTypeId } }
      : {};

    // Fetch signups in date range
    const signups = await prisma.signup.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        ...locationFilter,
        ...shiftTypeFilter,
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        canceledAt: true,
        cancellationReason: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        shift: {
          select: {
            start: true,
            end: true,
            location: true,
          },
        },
      },
    });

    // Group signups by date and status for time series
    const timeSeriesMap = new Map<
      string,
      {
        date: string;
        signups: number;
        confirmed: number;
        pending: number;
        canceled: number;
        noShows: number;
      }
    >();

    signups.forEach((signup) => {
      const dateKey = format(startOfDay(signup.createdAt), "yyyy-MM-dd");

      if (!timeSeriesMap.has(dateKey)) {
        timeSeriesMap.set(dateKey, {
          date: dateKey,
          signups: 0,
          confirmed: 0,
          pending: 0,
          canceled: 0,
          noShows: 0,
        });
      }

      const dayData = timeSeriesMap.get(dateKey)!;
      dayData.signups++;

      switch (signup.status) {
        case "CONFIRMED":
          dayData.confirmed++;
          break;
        case "PENDING":
          dayData.pending++;
          break;
        case "CANCELED":
          dayData.canceled++;
          break;
        case "NO_SHOW":
          dayData.noShows++;
          break;
      }
    });

    const timeSeriesData = Array.from(timeSeriesMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    // Cancellation reasons analysis
    const cancellationMap = new Map<string, number>();
    let totalCancellations = 0;

    signups
      .filter(
        (s) => s.status === "CANCELED" && s.cancellationReason
      )
      .forEach((signup) => {
        const reason = signup.cancellationReason || "Unknown";
        cancellationMap.set(reason, (cancellationMap.get(reason) || 0) + 1);
        totalCancellations++;
      });

    const cancellationReasons = Array.from(cancellationMap.entries())
      .map(([reason, count]) => ({
        reason,
        count,
        percentage:
          totalCancellations > 0
            ? Math.round((count / totalCancellations) * 100)
            : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // No-show patterns
    const noShowSignups = signups.filter((s) => s.status === "NO_SHOW");
    const noShowUserMap = new Map<string, number>();

    noShowSignups.forEach((signup) => {
      const userId = signup.user.id;
      noShowUserMap.set(userId, (noShowUserMap.get(userId) || 0) + 1);
    });

    const totalNoShows = noShowSignups.length;
    const totalSignups = signups.length;
    const noShowRate =
      totalSignups > 0 ? Math.round((totalNoShows / totalSignups) * 100) : 0;

    const topOffenders = Array.from(noShowUserMap.entries())
      .map(([userId, noShowCount]) => {
        const user = noShowSignups.find((s) => s.user.id === userId)?.user;
        const userSignups = signups.filter((s) => s.user.id === userId);

        return {
          userId,
          name: user?.name || "Unknown",
          noShowCount,
          totalSignups: userSignups.length,
        };
      })
      .filter((u) => u.noShowCount >= 2)
      .sort((a, b) => b.noShowCount - a.noShowCount)
      .slice(0, 10);

    const noShowPatterns = {
      totalNoShows,
      noShowRate,
      topOffenders,
    };

    // Peak signup times analysis
    const dayHourMap = new Map<string, number>();

    signups.forEach((signup) => {
      const day = signup.createdAt.getDay();
      const hour = signup.createdAt.getHours();
      const key = `${day}-${hour}`;
      dayHourMap.set(key, (dayHourMap.get(key) || 0) + 1);
    });

    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];

    const peakSignupTimes = Array.from(dayHourMap.entries())
      .map(([key, count]) => {
        const [day, hour] = key.split("-").map(Number);
        return {
          dayOfWeek: dayNames[day],
          hour,
          signupCount: count,
        };
      })
      .sort((a, b) => b.signupCount - a.signupCount)
      .slice(0, 10);

    return NextResponse.json({
      timeSeriesData,
      cancellationReasons,
      noShowPatterns,
      peakSignupTimes,
    });
  } catch (error) {
    console.error("Error fetching signup analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch signup analytics" },
      { status: 500 }
    );
  }
}
