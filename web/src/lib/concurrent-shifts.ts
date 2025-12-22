import { prisma } from "@/lib/prisma";
import { formatInNZT, toNZT } from "@/lib/timezone";

/**
 * Helper to determine if a shift is AM or PM (in NZ timezone)
 * Before 4pm (16:00) is considered "AM"
 */
function isAMShift(shiftStart: Date): boolean {
  const nzTime = toNZT(shiftStart);
  const hour = nzTime.getHours();
  return hour < 16;
}

/**
 * Helper to get shift date in NZ timezone (YYYY-MM-DD format)
 */
function getShiftDate(shiftStart: Date): string {
  return formatInNZT(shiftStart, "yyyy-MM-dd");
}

/**
 * Fetches all shifts happening at the same time as the specified shift
 * (same date, same AM/PM, same location)
 */
export async function getConcurrentShifts(shiftId: string) {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    select: {
      id: true,
      start: true,
      location: true,
    },
  });

  if (!shift) {
    return [];
  }

  const primaryDate = getShiftDate(shift.start);
  const primaryIsAM = isAMShift(shift.start);

  // Find all shifts at the same location
  const allShifts = await prisma.shift.findMany({
    where: {
      id: { not: shiftId },
      location: shift.location,
    },
    select: {
      id: true,
      start: true,
      capacity: true,
      shiftType: {
        select: {
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

  // Filter to only shifts on the same date and same AM/PM
  const concurrentShifts = allShifts.filter((s) => {
    const shiftDate = getShiftDate(s.start);
    const shiftIsAM = isAMShift(s.start);
    return shiftDate === primaryDate && shiftIsAM === primaryIsAM;
  });

  return concurrentShifts.map((s) => ({
    id: s.id,
    shiftTypeName: s.shiftType.name,
    shiftTypeDescription: s.shiftType.description,
    spotsRemaining: Math.max(0, s.capacity - s._count.signups),
  }));
}
