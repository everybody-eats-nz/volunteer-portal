import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    // Get upcoming shifts with signup counts
    const upcomingShifts = await prisma.shift.findMany({
      where: {
        start: {
          gte: new Date(),
        },
      },
      include: {
        shiftType: true,
        _count: {
          select: {
            signups: {
              where: {
                status: {
                  in: ["CONFIRMED", "REGULAR_PENDING"],
                },
              },
            },
          },
        },
      },
      orderBy: {
        start: "asc",
      },
    });

    // Filter to only show shifts with shortages (admin can decide what constitutes a shortage)
    // We'll show all shifts and let the admin decide based on the numbers
    const shiftsWithInfo = upcomingShifts.map(shift => ({
      ...shift,
      shortage: shift.capacity - shift._count.signups,
      percentFilled: (shift._count.signups / shift.capacity) * 100,
    }));

    return NextResponse.json(shiftsWithInfo);
  } catch (error) {
    console.error("Error fetching shifts with shortages:", error);
    return NextResponse.json(
      { error: "Failed to fetch shifts" },
      { status: 500 }
    );
  }
}