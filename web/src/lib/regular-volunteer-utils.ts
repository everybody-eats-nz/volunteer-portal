import { prisma } from "@/lib/prisma";
import { shiftsOverlap, type ShiftInterval } from "@/lib/concurrent-shifts";
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
  end: Date;
};

export type RegularSignupResult = {
  signupsCreated: number;
  /** The signup records that were (or would be) created */
  signupRecords: Array<{
    userId: string;
    shiftId: string;
    regularVolunteerId: string;
    status: "CONFIRMED" | "REGULAR_PENDING";
  }>;
};

/**
 * Match regular volunteers to shifts and create signups.
 *
 * Handles frequency filtering, deduplication, and batch persistence of
 * Signup + RegularSignup records. Deduplication follows the same rule the
 * signup endpoint enforces - one Day shift and one Evening shift per
 * volunteer per day - so a volunteer with both a prep schedule and an
 * evening service schedule has both populated.
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
      shift: { select: { start: true, end: true } },
    },
  });

  // A volunteer is only kept out of a shift that clashes in time with one they
  // already hold, matching the rule the signup endpoint enforces. This was a
  // date-plus-period bucket, which also blocked non-overlapping shifts.
  const bookedByUser = new Map<string, ShiftInterval[]>();
  const existingByShift = new Map<string, Set<string>>();
  // One regular schedule fills at most one shift a day, so a day carrying two
  // shifts of the same type doesn't book the volunteer into both.
  const claimedDates = new Map<string, Set<string>>();

  const claim = (map: Map<string, Set<string>>, key: string, value: string) => {
    const claimed = map.get(key);
    if (claimed) {
      claimed.add(value);
    } else {
      map.set(key, new Set([value]));
    }
  };

  const book = (userId: string, interval: ShiftInterval) => {
    const booked = bookedByUser.get(userId);
    if (booked) {
      booked.push(interval);
    } else {
      bookedByUser.set(userId, [interval]);
    }
  };

  const clashesForUser = (userId: string, shift: ShiftInterval) =>
    (bookedByUser.get(userId) ?? []).some((booked) =>
      shiftsOverlap(booked, shift)
    );

  for (const signup of existingSignups) {
    book(signup.userId, signup.shift);
    claim(existingByShift, signup.userId, signup.shiftId);
  }

  // Process shifts and build signup records
  const signupRecords: RegularSignupResult["signupRecords"] = [];
  // Ids are left to Prisma so a regular's signup is shaped like every other
  // signup in the table. Minting them here (they were UUIDs) put a second id
  // format into the column, and anything that assumed the usual shape - an
  // admin endpoint validating the id, an id-ordered query - quietly failed for
  // regular volunteers only.
  const dbSignups: Array<{
    userId: string;
    shiftId: string;
    status: "CONFIRMED" | "REGULAR_PENDING";
    createdAt: Date;
    updatedAt: Date;
  }> = [];
  // Which regular each pending signup belongs to, keyed by user+shift (the
  // signup's unique pair), so the RegularSignup join rows can be built from
  // the ids the insert returns.
  const regularVolunteerBySignup = new Map<string, string>();
  const signupKey = (userId: string, shiftId: string) => `${userId}|${shiftId}`;

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
      if (claimedDates.get(regular.id)?.has(dateKey)) {
        continue;
      }
      if (clashesForUser(regular.userId, shift)) {
        continue;
      }

      const status = regular.autoApprove ? "CONFIRMED" as const : "REGULAR_PENDING" as const;

      signupRecords.push({
        userId: regular.userId,
        shiftId: shift.id,
        regularVolunteerId: regular.id,
        status,
      });
      dbSignups.push({
        userId: regular.userId,
        shiftId: shift.id,
        status,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      regularVolunteerBySignup.set(signupKey(regular.userId, shift.id), regular.id);

      // Track within-batch to prevent double-assignment
      book(regular.userId, shift);
      claim(existingByShift, regular.userId, shift.id);
      claim(claimedDates, regular.id, dateKey);
    }
  }

  // Persist unless dry run
  if (!options?.dryRun && dbSignups.length > 0) {
    const BATCH_SIZE = 500;
    for (let i = 0; i < dbSignups.length; i += BATCH_SIZE) {
      const created = await prisma.signup.createManyAndReturn({
        data: dbSignups.slice(i, i + BATCH_SIZE),
        select: { id: true, userId: true, shiftId: true },
      });
      await prisma.regularSignup.createMany({
        data: created.flatMap((signup) => {
          const regularVolunteerId = regularVolunteerBySignup.get(
            signupKey(signup.userId, signup.shiftId)
          );
          return regularVolunteerId
            ? [{ regularVolunteerId, signupId: signup.id }]
            : [];
        }),
      });
    }
  }

  return { signupsCreated: signupRecords.length, signupRecords };
}
