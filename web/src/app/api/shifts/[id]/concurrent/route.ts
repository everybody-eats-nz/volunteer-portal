import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/shifts/[id]/concurrent
 * Fetches all shifts happening at the same time as the specified shift
 * Used for showing backup shift options during signup
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Fetch the primary shift
  const shift = await prisma.shift.findUnique({
    where: { id },
    select: {
      id: true,
      start: true,
      end: true,
      location: true,
      shiftType: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!shift) {
    return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  }

  // Find all shifts that overlap with this shift's time
  // A shift overlaps if:
  // - It starts before this shift ends AND
  // - It ends after this shift starts
  const concurrentShifts = await prisma.shift.findMany({
    where: {
      AND: [
        { id: { not: id } }, // Exclude the primary shift
        { start: { lt: shift.end } }, // Starts before primary shift ends
        { end: { gt: shift.start } }, // Ends after primary shift starts
        { location: shift.location }, // Same location
      ],
    },
    select: {
      id: true,
      start: true,
      end: true,
      location: true,
      capacity: true,
      shiftType: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
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

  return NextResponse.json({
    primaryShift: shift,
    concurrentShifts: concurrentShifts.map((s) => ({
      id: s.id,
      shiftTypeName: s.shiftType.name,
      shiftTypeDescription: s.shiftType.description,
      start: s.start,
      end: s.end,
      location: s.location,
      capacity: s.capacity,
      confirmedCount: s._count.signups,
      spotsRemaining: Math.max(0, s.capacity - s._count.signups),
    })),
  });
}
