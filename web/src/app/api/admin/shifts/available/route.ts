import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { startOfDay, endOfDay } from "date-fns";

// GET /api/admin/shifts/available - Get available shifts with capacity for a specific date/location
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
    
    // Fetch shifts for the selected date and location that have available capacity
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
        signups: {
          where: {
            status: "CONFIRMED",
          },
        },
      },
      orderBy: {
        start: "asc",
      },
    });

    // Transform to include confirmed count and filter for available capacity
    const availableShifts = shifts
      .map(shift => ({
        id: shift.id,
        start: shift.start.toISOString(),
        end: shift.end.toISOString(),
        location: shift.location,
        capacity: shift.capacity,
        confirmedCount: shift.signups.length,
        shiftType: {
          id: shift.shiftType.id,
          name: shift.shiftType.name,
        },
      }))
      .filter(shift => shift.confirmedCount < shift.capacity); // Only return shifts with available spots

    return NextResponse.json(availableShifts);
  } catch (error) {
    console.error("Error fetching available shifts:", error);
    return NextResponse.json(
      { error: "Failed to fetch available shifts" },
      { status: 500 }
    );
  }
}