import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { startOfDay, endOfDay } from "date-fns";
import {
  getShiftEffectiveCount,
  shiftCapacityCountSelect,
} from "@/lib/placeholder-utils";

// GET /api/admin/shifts/available - Get shifts for a specific date/location.
// Full shifts are returned too, with their counts, so admins can move a volunteer
// into an over-capacity shift when they judge that the right call. Callers are
// expected to label capacity rather than hide the option.
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const location = searchParams.get("location");

  if (!date || !location) {
    return NextResponse.json(
      { error: "Date and location parameters are required" },
      { status: 400 }
    );
  }

  try {
    const selectedDate = new Date(date);

    // Fetch every shift for the selected date and location
    const shifts = await prisma.shift.findMany({
      where: {
        location,
        start: {
          gte: startOfDay(selectedDate),
          lte: endOfDay(selectedDate),
        },
      },
      include: {
        shiftType: true,
        _count: shiftCapacityCountSelect(["CONFIRMED"]),
      },
      orderBy: {
        start: "asc",
      },
    });

    // Transform to include confirmed count so callers can show remaining capacity
    const availableShifts = shifts.map((shift) => ({
      id: shift.id,
      start: shift.start.toISOString(),
      end: shift.end.toISOString(),
      location: shift.location,
      capacity: shift.capacity,
      confirmedCount: getShiftEffectiveCount(shift),
      shiftType: {
        id: shift.shiftType.id,
        name: shift.shiftType.name,
      },
    }));

    return NextResponse.json(availableShifts);
  } catch (error) {
    console.error("Error fetching available shifts:", error);
    return NextResponse.json(
      { error: "Failed to fetch available shifts" },
      { status: 500 }
    );
  }
}