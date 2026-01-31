import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay } from "date-fns";
import { parseISOInNZT, toUTC } from "@/lib/timezone";

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const location = searchParams.get("location");

    if (!date) {
      return NextResponse.json(
        { error: "Date parameter is required" },
        { status: 400 }
      );
    }

    if (!location) {
      return NextResponse.json(
        { error: "Location parameter is required" },
        { status: 400 }
      );
    }

    // Parse date in NZ timezone and calculate day boundaries
    const selectedDateNZT = parseISOInNZT(date);
    const startOfDayNZ = startOfDay(selectedDateNZT);
    const endOfDayNZ = endOfDay(selectedDateNZT);
    const startOfDayUTC = toUTC(startOfDayNZ);
    const endOfDayUTC = toUTC(endOfDayNZ);

    // Find all shifts for the given date and location
    const shifts = await prisma.shift.findMany({
      where: {
        location,
        start: {
          gte: startOfDayUTC,
          lte: endOfDayUTC,
        },
      },
      include: {
        signups: {
          where: {
            status: {
              in: ["CONFIRMED", "PENDING", "WAITLISTED", "REGULAR_PENDING"],
            },
          },
        },
      },
    });

    if (shifts.length === 0) {
      return NextResponse.json(
        { error: "No shifts found for the specified date and location" },
        { status: 404 }
      );
    }

    const shiftIds = shifts.map((s) => s.id);
    const affectedVolunteers = shifts.reduce(
      (sum, s) => sum + s.signups.length,
      0
    );

    // Delete in a transaction: signups → group bookings → shifts
    await prisma.$transaction(async (tx) => {
      // Delete all signups for these shifts
      await tx.signup.deleteMany({
        where: { shiftId: { in: shiftIds } },
      });

      // Delete all group bookings for these shifts
      await tx.groupBooking.deleteMany({
        where: { shiftId: { in: shiftIds } },
      });

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
    console.error("Error deleting shifts by date:", error);
    return NextResponse.json(
      { error: "Failed to delete shifts" },
      { status: 500 }
    );
  }
}
