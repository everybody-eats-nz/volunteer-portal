import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/client";
import { formatInNZT } from "@/lib/timezone";
import { getShiftDate, isDayShift } from "@/lib/shift-periods";

// Re-exported so server modules can keep importing period helpers from here.
export {
  DAY_EVENING_CUTOFF_HOUR,
  getShiftDate,
  getShiftPeriodLabel,
  isDayShift,
  shiftsOverlap,
} from "@/lib/shift-periods";
export type { ShiftInterval } from "@/lib/shift-periods";
import {
  getShiftEffectiveCount,
  shiftCapacityCountSelect,
  SPOT_TAKING_STATUSES,
} from "@/lib/placeholder-utils";
import { getShiftDescription } from "@/lib/shift-description";

/**
 * SQL fragment to convert a UTC timestamp column to NZ local time.
 * Prisma stores DateTime as `timestamp without time zone` in UTC,
 * so we must first interpret it as UTC before converting to NZ.
 *
 * Usage: Prisma.sql`EXTRACT(HOUR FROM ${shiftStartNZ('"sh"."start"')}) < ${DAY_EVENING_CUTOFF_HOUR}`
 */
export function shiftStartNZ(column = 'sh.start'): Prisma.Sql {
  return Prisma.raw(`(${column} AT TIME ZONE 'UTC') AT TIME ZONE 'Pacific/Auckland'`);
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
  const primaryIsAM = isDayShift(shift.start);

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
      notes: true,
      shiftType: {
        select: {
          name: true,
          description: true,
        },
      },
      _count: shiftCapacityCountSelect(SPOT_TAKING_STATUSES),
    },
    orderBy: {
      start: "asc",
    },
  });

  // Filter to only shifts on the same date and same AM/PM
  const concurrentShifts = allShifts.filter((s) => {
    const shiftDate = getShiftDate(s.start);
    const shiftIsDay = isDayShift(s.start);
    return shiftDate === primaryDate && shiftIsDay === primaryIsAM;
  });

  return concurrentShifts.map((s) => ({
    id: s.id,
    shiftTypeName: s.shiftType.name,
    shiftTypeDescription: getShiftDescription(s.notes, s.shiftType.description),
    spotsRemaining: Math.max(0, s.capacity - getShiftEffectiveCount(s)),
  }));
}

/**
 * Finds an existing signup whose time overlaps `shiftStart`–`shiftEnd`.
 *
 * Volunteers may hold any number of shifts on a day as long as the times do not
 * clash; only a genuine double-booking is refused. This replaced a Day/Evening
 * bucket rule that also blocked non-overlapping shifts (an 11:30am–2:30pm and a
 * 3pm both counted as "day"), which volunteers reported as a bug.
 *
 * The overlap is evaluated in SQL against absolute instants, so unlike the
 * calendar-day rule it needs no timezone or DST handling.
 */
export async function findOverlappingSignup({
  userId,
  shiftStart,
  shiftEnd,
  excludeShiftId,
}: {
  userId: string;
  shiftStart: Date;
  shiftEnd: Date;
  excludeShiftId?: string;
}) {
  return prisma.signup.findFirst({
    where: {
      userId,
      status: { in: ["CONFIRMED", "PENDING"] },
      ...(excludeShiftId ? { shiftId: { not: excludeShiftId } } : {}),
      // Half-open, matching `shiftsOverlap`: a shift starting exactly as
      // another ends is back-to-back, not a clash.
      shift: { start: { lt: shiftEnd }, end: { gt: shiftStart } },
    },
    include: { shift: { include: { shiftType: true } } },
    orderBy: { shift: { start: "asc" } },
  });
}

/**
 * Builds the volunteer-facing explanation for an overlapping signup.
 */
export function buildOverlapMessage({
  conflictingSignup,
  subject = "you",
}: {
  conflictingSignup: {
    status: string;
    shift: {
      start: Date;
      end: Date;
      location: string | null;
      shiftType: { name: string };
    };
  };
  subject?: "you" | "volunteer";
}) {
  const { start, end, location, shiftType } = conflictingSignup.shift;
  const time = `${formatInNZT(start, "h:mm a")} to ${formatInNZT(end, "h:mm a")}`;
  const date = formatInNZT(start, "EEEE d MMMM");
  // PENDING signups hold a spot too, so don't call them "confirmed".
  const held = conflictingSignup.status === "PENDING" ? "a pending" : "a confirmed";
  const clash = `${held} shift that overlaps this one: ${shiftType.name} at ${
    location ?? "TBD"
  }, ${time} on ${date}.`;

  return subject === "volunteer"
    ? `This volunteer already has ${clash} Volunteers can hold several shifts a day, but not at the same time.`
    : `You already have ${clash} You can take more than one shift a day, as long as the times don't clash.`;
}
