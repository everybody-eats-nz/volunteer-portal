import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/client";
import { formatInNZT, getStartOfDayUTC, toNZT } from "@/lib/timezone";
import {
  getShiftEffectiveCount,
  shiftCapacityCountSelect,
  SPOT_TAKING_STATUSES,
} from "@/lib/placeholder-utils";
import { getShiftDescription } from "@/lib/shift-description";

/** Hour cutoff (NZ time) — shifts starting before this are "Day", at or after are "Evening" */
export const DAY_EVENING_CUTOFF_HOUR = 16;

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
 * Whether a shift falls in the day period (before 4pm NZ time).
 */
export function isAMShift(shiftStart: Date): boolean {
  const nzTime = toNZT(shiftStart);
  const hour = nzTime.getHours();
  return hour < DAY_EVENING_CUTOFF_HOUR;
}

/**
 * Returns a display label for the shift period: "Day" or "Evening".
 */
export function getShiftPeriodLabel(shiftStart: Date): string {
  return isAMShift(shiftStart) ? "Day" : "Evening";
}

/**
 * Helper to get shift date in NZ timezone (YYYY-MM-DD format)
 */
export function getShiftDate(shiftStart: Date): string {
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
    const shiftIsAM = isAMShift(s.start);
    return shiftDate === primaryDate && shiftIsAM === primaryIsAM;
  });

  return concurrentShifts.map((s) => ({
    id: s.id,
    shiftTypeName: s.shiftType.name,
    shiftTypeDescription: getShiftDescription(s.notes, s.shiftType.description),
    spotsRemaining: Math.max(0, s.capacity - getShiftEffectiveCount(s)),
  }));
}

/**
 * Finds an existing signup that blocks the user from taking `shiftStart`:
 * same NZ calendar day, same Day/Evening period, still holding a spot
 * (CONFIRMED or PENDING).
 *
 * Only the target day is queried — the previous implementation loaded every
 * confirmed/pending signup the volunteer had ever made and filtered in memory.
 */
export async function findPeriodConflictSignup({
  userId,
  shiftStart,
  excludeShiftId,
}: {
  userId: string;
  shiftStart: Date;
  excludeShiftId?: string;
}) {
  // Padded by a day on each side because an NZ calendar day is 23 or 25 hours
  // long across a DST switch — a tight 24-hour window drops an 11:30pm shift on
  // the April changeover. The exact NZ date is asserted below, so the padding
  // only widens the candidate set, never the match.
  const dayStartUTC = getStartOfDayUTC(shiftStart);
  const windowStartUTC = new Date(dayStartUTC.getTime() - 24 * 60 * 60 * 1000);
  const windowEndUTC = new Date(dayStartUTC.getTime() + 48 * 60 * 60 * 1000);

  const sameDaySignups = await prisma.signup.findMany({
    where: {
      userId,
      status: { in: ["CONFIRMED", "PENDING"] },
      ...(excludeShiftId ? { shiftId: { not: excludeShiftId } } : {}),
      shift: { start: { gte: windowStartUTC, lt: windowEndUTC } },
    },
    include: { shift: { include: { shiftType: true } } },
  });

  const shiftDate = getShiftDate(shiftStart);
  const shiftIsDay = isAMShift(shiftStart);

  return sameDaySignups.find(
    (signup) =>
      getShiftDate(signup.shift.start) === shiftDate &&
      isAMShift(signup.shift.start) === shiftIsDay
  );
}

/**
 * Builds the volunteer-facing explanation for a Day/Evening conflict.
 *
 * The period boundary is 4pm, not midday, so the message must never call the
 * blocking shift an "AM"/"PM" shift — a 3pm shift is a Day shift, and labelling
 * it "AM" reads as a bug to volunteers.
 */
export function buildPeriodConflictMessage({
  conflictingSignup,
  shiftStart,
  subject = "you",
}: {
  conflictingSignup: {
    status: string;
    shift: { start: Date; location: string | null; shiftType: { name: string } };
  };
  shiftStart: Date;
  subject?: "you" | "volunteer";
}) {
  const existingShiftTime = new Intl.DateTimeFormat("en-NZ", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Pacific/Auckland",
  }).format(conflictingSignup.shift.start);

  const period = getShiftPeriodLabel(shiftStart).toLowerCase();
  const date = formatInNZT(conflictingSignup.shift.start, "EEEE d MMMM");
  const location = conflictingSignup.shift.location ?? "TBD";
  const shiftName = conflictingSignup.shift.shiftType.name;
  // PENDING signups block a second shift too, so don't call them "confirmed".
  const held = conflictingSignup.status === "PENDING" ? "a pending" : "a confirmed";
  const boundary =
    "Day shifts start before 4pm and evening shifts start from 4pm, so only one of each is allowed per day.";
  const clash = `${held} ${period} shift on ${date}: ${shiftName} at ${location}, ${existingShiftTime}.`;

  return subject === "volunteer"
    ? `This volunteer already has ${clash} ${boundary}`
    : `You already have ${clash} ${boundary}`;
}
