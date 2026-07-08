import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { deleteNotificationsForDeletedShifts } from "@/lib/notifications";
import { startOfDay, endOfDay, differenceInCalendarDays } from "date-fns";
import { parseISOInNZT, toUTC } from "@/lib/timezone";
import { ACTIVE_SIGNUP_STATUSES } from "@/lib/signup-constants";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;

type RangeParams =
  | { error: string }
  | { startUTC: Date; endUTC: Date; location: string };

function parseRangeParams(request: NextRequest): RangeParams {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const location = searchParams.get("location");

  if (!startDate || !DATE_PATTERN.test(startDate)) {
    return { error: "startDate parameter is required (yyyy-MM-dd)" };
  }
  if (!endDate || !DATE_PATTERN.test(endDate)) {
    return { error: "endDate parameter is required (yyyy-MM-dd)" };
  }
  if (!location) {
    return { error: "Location parameter is required" };
  }

  // Parse dates in NZ timezone and expand to full-day boundaries
  const startNZT = parseISOInNZT(startDate);
  const endNZT = parseISOInNZT(endDate);

  if (isNaN(startNZT.getTime()) || isNaN(endNZT.getTime())) {
    return { error: "Invalid date provided" };
  }

  const rangeDays = differenceInCalendarDays(endNZT, startNZT) + 1;
  if (rangeDays < 1) {
    return { error: "endDate must be on or after startDate" };
  }
  if (rangeDays > MAX_RANGE_DAYS) {
    return { error: `Date range cannot exceed ${MAX_RANGE_DAYS} days` };
  }

  return {
    startUTC: toUTC(startOfDay(startNZT)),
    endUTC: toUTC(endOfDay(endNZT)),
    location,
  };
}

/**
 * Preview which shifts fall inside a date range so the admin can confirm
 * the blast radius before deleting.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const params = parseRangeParams(request);
    if ("error" in params) {
      return NextResponse.json({ error: params.error }, { status: 400 });
    }

    const shifts = await prisma.shift.findMany({
      where: {
        location: params.location,
        start: { gte: params.startUTC, lte: params.endUTC },
      },
      select: {
        shiftType: { select: { name: true } },
        _count: {
          select: {
            signups: {
              where: { status: { in: ACTIVE_SIGNUP_STATUSES } },
            },
          },
        },
      },
    });

    return NextResponse.json({
      shiftCount: shifts.length,
      volunteerCount: shifts.reduce((sum, s) => sum + s._count.signups, 0),
      shiftTypes: [...new Set(shifts.map((s) => s.shiftType.name))],
    });
  } catch (error) {
    console.error("Error previewing shifts by date range:", error);
    return NextResponse.json(
      { error: "Failed to load shifts for the date range" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const params = parseRangeParams(request);
    if ("error" in params) {
      return NextResponse.json({ error: params.error }, { status: 400 });
    }

    // Find all shifts within the range for the location
    const shifts = await prisma.shift.findMany({
      where: {
        location: params.location,
        start: { gte: params.startUTC, lte: params.endUTC },
      },
      include: {
        signups: {
          where: { status: { in: ACTIVE_SIGNUP_STATUSES } },
        },
      },
    });

    if (shifts.length === 0) {
      return NextResponse.json(
        { error: "No shifts found for the specified date range and location" },
        { status: 404 }
      );
    }

    const shiftIds = shifts.map((s) => s.id);
    const affectedVolunteers = shifts.reduce(
      (sum, s) => sum + s.signups.length,
      0
    );

    // Delete in a transaction: signups → shifts
    await prisma.$transaction(async (tx) => {
      // Delete all signups for these shifts
      await tx.signup.deleteMany({
        where: { shiftId: { in: shiftIds } },
      });

      // Clear dangling notifications deep-linking to these shifts. The
      // Notification model has no FK/cascade to Shift, so their
      // `/shifts/{id}` and `/admin/shifts/{id}` links would otherwise survive
      // as dead "Shift not found" links.
      const { count } = await deleteNotificationsForDeletedShifts(
        shiftIds,
        tx
      );
      if (count > 0) {
        console.info(
          `Cleaned up ${count} dangling notification(s) for ${shiftIds.length} deleted shift(s)`
        );
      }

      // Delete the shifts
      await tx.shift.deleteMany({
        where: { id: { in: shiftIds } },
      });
    });

    return NextResponse.json({
      success: true,
      deletedCount: shifts.length,
      affectedVolunteers,
    });
  } catch (error) {
    console.error("Error deleting shifts by date range:", error);
    return NextResponse.json(
      { error: "Failed to delete shifts" },
      { status: 500 }
    );
  }
}
