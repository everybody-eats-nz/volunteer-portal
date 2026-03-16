import { prisma } from "@/lib/prisma";
import { formatInNZT } from "@/lib/timezone";

/**
 * Check if a regular volunteer's frequency matches a given shift date.
 * - WEEKLY: always matches
 * - FORTNIGHTLY: matches every other week since createdAt
 * - MONTHLY: matches only the first occurrence of that weekday in the month
 */
export function matchesFrequency(
  frequency: string,
  shiftDate: Date,
  createdAt: Date
): boolean {
  if (frequency === "WEEKLY") {
    return true;
  }
  if (frequency === "FORTNIGHTLY") {
    const weeksSinceCreation = Math.floor(
      (shiftDate.getTime() - createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    return weeksSinceCreation % 2 === 0;
  }
  if (frequency === "MONTHLY") {
    const firstOccurrence = new Date(
      shiftDate.getFullYear(),
      shiftDate.getMonth(),
      1
    );
    while (firstOccurrence.getDay() !== shiftDate.getDay()) {
      firstOccurrence.setDate(firstOccurrence.getDate() + 1);
    }
    return shiftDate.getDate() === firstOccurrence.getDate();
  }
  return false;
}

// Minimal types for the shared signup creation logic
export type RegularVolunteerForMatching = {
  id: string;
  userId: string;
  shiftTypeId: string;
  location: string;
  frequency: string;
  availableDays: string[];
  autoApprove: boolean;
  createdAt: Date;
};

export type ShiftForMatching = {
  id: string;
  shiftTypeId: string;
  location: string | null;
  start: Date;
};

export type RegularSignupResult = {
  signupsCreated: number;
  /** The signup records that were (or would be) created */
  signupRecords: Array<{
    id: string;
    userId: string;
    shiftId: string;
    regularVolunteerId: string;
    status: "CONFIRMED" | "REGULAR_PENDING";
  }>;
};

/**
 * Match regular volunteers to shifts and create signups.
 *
 * Handles frequency filtering, existing signup deduplication (by both
 * shift and day), and batch persistence of Signup + RegularSignup records.
 *
 * @param shifts - The shifts to process
 * @param regularVolunteers - The regular volunteers to match against
 * @param options.dryRun - If true, compute matches without persisting
 */
export async function createRegularVolunteerSignups(
  shifts: ShiftForMatching[],
  regularVolunteers: RegularVolunteerForMatching[],
  options?: { dryRun?: boolean }
): Promise<RegularSignupResult> {
  if (shifts.length === 0 || regularVolunteers.length === 0) {
    return { signupsCreated: 0, signupRecords: [] };
  }

  // Build volunteer lookup: (shiftTypeId|location|dayOfWeek) -> volunteers[]
  const regularsByConfig = new Map<string, RegularVolunteerForMatching[]>();
  for (const regular of regularVolunteers) {
    for (const day of regular.availableDays) {
      const key = `${regular.shiftTypeId}|${regular.location || ""}|${day}`;
      if (!regularsByConfig.has(key)) {
        regularsByConfig.set(key, []);
      }
      regularsByConfig.get(key)!.push(regular);
    }
  }

  // Query existing signups for all volunteers across the shift date range
  const volunteerIds = [...new Set(regularVolunteers.map((r) => r.userId))];
  const startTimes = shifts.map((s) => s.start.getTime());
  const minStart = new Date(Math.min(...startTimes));
  const maxEnd = new Date(Math.max(...startTimes) + 24 * 60 * 60 * 1000);

  const existingSignups = await prisma.signup.findMany({
    where: {
      userId: { in: volunteerIds },
      shift: { start: { gte: minStart, lt: maxEnd } },
      status: { in: ["CONFIRMED", "REGULAR_PENDING", "PENDING"] },
    },
    select: {
      userId: true,
      shiftId: true,
      shift: { select: { start: true } },
    },
  });

  // Build dual lookup maps for deduplication
  const existingByDate = new Map<string, Set<string>>();
  const existingByShift = new Map<string, Set<string>>();
  for (const signup of existingSignups) {
    const dateKey = formatInNZT(signup.shift.start, "yyyy-MM-dd");

    if (!existingByDate.has(signup.userId)) {
      existingByDate.set(signup.userId, new Set());
    }
    existingByDate.get(signup.userId)!.add(dateKey);

    if (!existingByShift.has(signup.userId)) {
      existingByShift.set(signup.userId, new Set());
    }
    existingByShift.get(signup.userId)!.add(signup.shiftId);
  }

  // Process shifts and build signup records
  const signupRecords: RegularSignupResult["signupRecords"] = [];
  const dbSignups: Array<{
    id: string;
    userId: string;
    shiftId: string;
    status: "CONFIRMED" | "REGULAR_PENDING";
    createdAt: Date;
    updatedAt: Date;
  }> = [];
  const dbRegularSignups: Array<{
    regularVolunteerId: string;
    signupId: string;
  }> = [];

  for (const shift of shifts) {
    const dayOfWeek = formatInNZT(shift.start, "EEEE");
    const dateKey = formatInNZT(shift.start, "yyyy-MM-dd");
    const key = `${shift.shiftTypeId}|${shift.location || ""}|${dayOfWeek}`;
    const candidates = regularsByConfig.get(key) || [];

    for (const regular of candidates) {
      if (!matchesFrequency(regular.frequency, shift.start, regular.createdAt)) {
        continue;
      }
      if (existingByShift.get(regular.userId)?.has(shift.id)) {
        continue;
      }
      if (existingByDate.get(regular.userId)?.has(dateKey)) {
        continue;
      }

      const signupId = crypto.randomUUID();
      const status = regular.autoApprove ? "CONFIRMED" as const : "REGULAR_PENDING" as const;

      signupRecords.push({
        id: signupId,
        userId: regular.userId,
        shiftId: shift.id,
        regularVolunteerId: regular.id,
        status,
      });
      dbSignups.push({
        id: signupId,
        userId: regular.userId,
        shiftId: shift.id,
        status,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      dbRegularSignups.push({
        regularVolunteerId: regular.id,
        signupId,
      });

      // Track within-batch to prevent double-assignment
      if (!existingByDate.has(regular.userId)) {
        existingByDate.set(regular.userId, new Set());
      }
      existingByDate.get(regular.userId)!.add(dateKey);
      if (!existingByShift.has(regular.userId)) {
        existingByShift.set(regular.userId, new Set());
      }
      existingByShift.get(regular.userId)!.add(shift.id);
    }
  }

  // Persist unless dry run
  if (!options?.dryRun && dbSignups.length > 0) {
    const BATCH_SIZE = 500;
    for (let i = 0; i < dbSignups.length; i += BATCH_SIZE) {
      await prisma.signup.createMany({
        data: dbSignups.slice(i, i + BATCH_SIZE),
      });
      await prisma.regularSignup.createMany({
        data: dbRegularSignups.slice(i, i + BATCH_SIZE),
      });
    }
  }

  return { signupsCreated: signupRecords.length, signupRecords };
}
