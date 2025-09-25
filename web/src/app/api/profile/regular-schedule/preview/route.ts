import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { addWeeks, startOfDay, endOfDay, format } from "date-fns";

// GET /api/profile/regular-schedule/preview - Preview upcoming regular shifts
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const weeks = parseInt(searchParams.get("weeks") || "4");

    // Get user's regular volunteer record
    const regular = await prisma.regularVolunteer.findUnique({
      where: { userId: session.user?.id },
      include: {
        shiftType: true,
      },
    });

    if (!regular) {
      return NextResponse.json(
        { error: "You are not registered as a regular volunteer" },
        { status: 404 }
      );
    }

    if (!regular.isActive || regular.isPausedByUser) {
      return NextResponse.json({
        message: "Regular schedule is currently inactive or paused",
        shifts: [],
      });
    }

    // Calculate dates for preview
    const startDate = startOfDay(new Date());
    const endDate = endOfDay(addWeeks(startDate, weeks));

    // If there's a pause end date, use that as start
    const effectiveStartDate =
      regular.pausedUntil && regular.pausedUntil > startDate
        ? startOfDay(regular.pausedUntil)
        : startDate;

    const effectiveEndDate = endDate;

    // Get existing shifts that match the criteria
    const existingShifts = await prisma.shift.findMany({
      where: {
        shiftTypeId: regular.shiftTypeId,
        location: regular.location,
        start: {
          gte: effectiveStartDate,
          lte: effectiveEndDate,
        },
      },
      include: {
        shiftType: true,
        signups: {
          where: {
            userId: session.user?.id,
          },
        },
      },
      orderBy: {
        start: "asc",
      },
    });

    // Filter shifts based on available days
    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const matchingShifts = existingShifts.filter((shift) => {
      const shiftDay = dayNames[new Date(shift.start).getDay()];
      return regular.availableDays.includes(shiftDay);
    });

    // Calculate frequency filter
    const frequencyFilteredShifts = matchingShifts.filter((shift, index) => {
      if (regular.frequency === "WEEKLY") {
        return true;
      } else if (regular.frequency === "FORTNIGHTLY") {
        // Check if this is an even or odd week from start date
        const weeksSinceStart = Math.floor(
          (new Date(shift.start).getTime() - regular.createdAt.getTime()) /
            (7 * 24 * 60 * 60 * 1000)
        );
        return weeksSinceStart % 2 === 0;
      } else if (regular.frequency === "MONTHLY") {
        // Only first occurrence of the month
        const shiftMonth = format(new Date(shift.start), "yyyy-MM");
        const previousShifts = matchingShifts.slice(0, index);
        return !previousShifts.some(
          (s) => format(new Date(s.start), "yyyy-MM") === shiftMonth
        );
      }
      return false;
    });

    // Mark shifts with their signup status
    const shiftsWithStatus = frequencyFilteredShifts.map((shift) => ({
      ...shift,
      regularStatus:
        shift.signups.length > 0 ? shift.signups[0].status : "WILL_AUTO_APPLY",
      isRegularShift: true,
    }));

    return NextResponse.json({
      regular,
      previewWeeks: weeks,
      startDate: effectiveStartDate,
      endDate: effectiveEndDate,
      shifts: shiftsWithStatus,
    });
  } catch (error) {
    console.error("Error previewing regular schedule:", error);
    return NextResponse.json(
      { error: "Failed to preview regular schedule" },
      { status: 500 }
    );
  }
}
