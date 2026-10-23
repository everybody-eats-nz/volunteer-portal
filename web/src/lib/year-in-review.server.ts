import { prisma } from "@/lib/prisma";
import { checkAndUnlockAchievements } from "@/lib/achievements";
import { FOOD_SAVED_KG_PER_MEAL } from "@/lib/impact-stats";
import { SERVICE_NIGHTS_ONLY } from "@/lib/day-reports";
import { formatInNZT } from "@/lib/timezone";
import {
  greetingName,
  nightKey,
  nzDayRange,
  nzYearRange,
  rankFriendsByNights,
  summariseShifts,
  topPercent,
} from "@/lib/year-in-review";
import type { YearInReviewProps } from "@/remotion/year-in-review/schema";

/**
 * Builds the input props for one volunteer's "Year in mahi" video.
 *
 * A shift counts once it's CONFIRMED and finished, the same basis as the
 * portal's hours and achievements, so a year still in progress covers the
 * year so far. Returns null when the volunteer has no completed shifts that
 * year: there's no story to tell.
 */
export async function getVolunteerYearInReview(
  userId: string,
  year: number,
  now: Date = new Date()
): Promise<YearInReviewProps | null> {
  const range = nzYearRange(year);
  // Achievements only unlock when evaluated, so catch up before reading them.
  await checkAndUnlockAchievements(userId);
  const completedInYear = {
    status: "CONFIRMED" as const,
    shift: { start: { gte: range.start, lt: range.end }, end: { lt: now } },
  };

  const [user, signups] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, name: true },
    }),
    prisma.signup.findMany({
      where: { userId, ...completedInYear },
      select: {
        shift: {
          select: {
            start: true,
            end: true,
            location: true,
            shiftType: { select: { name: true } },
          },
        },
      },
    }),
  ]);
  if (!user || signups.length === 0) return null;

  const shifts = signups.map(({ shift }) => ({
    start: shift.start,
    end: shift.end,
    location: shift.location,
    role: shift.shiftType.name,
  }));
  const summary = summariseShifts(shifts);
  const myNights = new Set(shifts.map((s) => nightKey(s.start, s.location)));
  const myLocations = summary.locations.map((l) => l.name);

  const [
    dayReports,
    coVolunteerNights,
    friendships,
    achievements,
    shiftCountsByVolunteer,
    organisationYear,
  ] = await Promise.all([
    prisma.mealsServed.findMany({
      where: {
        date: { gte: range.start, lt: range.end },
        location: { in: myLocations },
      },
      select: { date: true, location: true, mealsServed: true },
    }),
    getCoVolunteerNights(userId, myNights),
    prisma.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ userId }, { friendId: userId }],
      },
      select: {
        user: {
          select: {
            id: true,
            firstName: true,
            name: true,
            profilePhotoUrl: true,
            friendVisibility: true,
          },
        },
        friend: {
          select: {
            id: true,
            firstName: true,
            name: true,
            profilePhotoUrl: true,
            friendVisibility: true,
          },
        },
      },
    }),
    prisma.userAchievement.findMany({
      where: {
        userId,
        unlockedAt: { gte: range.start, lt: range.end },
        achievement: { isActive: true },
      },
      orderBy: { unlockedAt: "asc" },
      select: {
        achievement: {
          select: { name: true, icon: true, description: true },
        },
      },
    }),
    prisma.signup.groupBy({
      by: ["userId"],
      where: completedInYear,
      _count: { _all: true },
    }),
    getOrganisationYear(range, now),
  ]);

  const mealsServed = dayReports
    .filter((r) => myNights.has(nightKey(r.date, r.location)))
    .reduce((sum, r) => sum + (r.mealsServed ?? 0), 0);

  // Friends who keep their shift activity private stay out of the video.
  const friends = new Map(
    friendships
      .map((f) => (f.user.id === userId ? f.friend : f.user))
      .filter((f) => f.friendVisibility !== "PRIVATE")
      .map((f) => [f.id, f])
  );

  return {
    year,
    firstName: greetingName(user),
    shifts: {
      completed: summary.completed,
      hours: summary.hours,
      nights: summary.nights,
      first: summary.first!,
    },
    impact: {
      mealsServed,
      foodSavedKg: Math.round(mealsServed * FOOD_SAVED_KG_PER_MEAL),
    },
    rhythm: {
      months: summary.months,
      busiestMonth: summary.busiestMonth,
      favouriteWeekday: summary.favouriteWeekday,
      favouriteWeekdayCount: summary.favouriteWeekdayCount,
    },
    roles: summary.roles,
    locations: summary.locations,
    crew: {
      alongside: new Set(coVolunteerNights.map((c) => c.userId)).size,
      friends: rankFriendsByNights(
        [...friends.values()],
        coVolunteerNights
      ).map((friend) => ({
        name: greetingName(friend),
        nights: friend.nights,
        photoUrl: friend.profilePhotoUrl,
      })),
    },
    achievements: achievements.map((a) => a.achievement),
    topPercent: topPercent(
      summary.completed,
      shiftCountsByVolunteer.map((v) => v._count._all)
    ),
    organisation: {
      ...organisationYear,
      volunteers: shiftCountsByVolunteer.length,
    },
  };
}

/**
 * Everyone else rostered on the volunteer's nights at the same restaurant,
 * one row per person per night.
 *
 * A single join against the nights passed in as arrays: a Prisma `OR` per
 * night becomes one join per night, which took seconds for a volunteer with a
 * couple of hundred shifts.
 */
async function getCoVolunteerNights(
  userId: string,
  nights: Set<string>
): Promise<{ userId: string; night: string }[]> {
  const keys = [...nights];
  const locations: (string | null)[] = [];
  const starts: string[] = [];
  const ends: string[] = [];
  for (const night of keys) {
    const [day, location] = night.split("|");
    const { start, end } = nzDayRange(day);
    locations.push(location || null);
    starts.push(start.toISOString());
    ends.push(end.toISOString());
  }

  return prisma.$queryRaw<{ userId: string; night: string }[]>`
    SELECT DISTINCT sg."userId", n.night
    FROM unnest(
      ${keys}::text[], ${locations}::text[], ${starts}::text[], ${ends}::text[]
    ) AS n(night, location, day_start, day_end)
    JOIN "Shift" s
      ON s.location IS NOT DISTINCT FROM n.location
      AND s."start" >= n.day_start::timestamp
      AND s."start" < n.day_end::timestamp
    JOIN "Signup" sg ON sg."shiftId" = s.id
    WHERE sg.status = 'CONFIRMED' AND sg."userId" <> ${userId}
  `;
}

/** Everybody Eats' year across every restaurant, for the "together" scene. */
async function getOrganisationYear(
  range: { start: Date; end: Date },
  now: Date
): Promise<Omit<YearInReviewProps["organisation"], "volunteers">> {
  const [meals, serviceNights, events, hours] = await Promise.all([
    // People served counts towards impact for every kind of day report.
    prisma.mealsServed.aggregate({
      where: { date: { gte: range.start, lt: range.end } },
      _sum: { mealsServed: true },
    }),
    prisma.mealsServed.count({
      where: {
        date: { gte: range.start, lt: range.end },
        ...SERVICE_NIGHTS_ONLY,
      },
    }),
    prisma.mealsServed.findMany({
      where: {
        date: { gte: range.start, lt: range.end },
        reportType: "EVENT",
      },
      orderBy: { date: "asc" },
      select: { date: true, location: true, eventName: true },
    }),
    prisma.$queryRaw<{ seconds: number }[]>`
      SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (s."end" - s."start"))), 0)::float8 AS seconds
      FROM "Signup" sg
      JOIN "Shift" s ON s.id = sg."shiftId"
      WHERE sg.status = 'CONFIRMED'
        AND s."start" >= ${range.start} AND s."start" < ${range.end}
        AND s."end" < ${now}
    `,
  ]);

  return {
    mealsServed: meals._sum.mealsServed ?? 0,
    serviceNights,
    volunteerHours: Math.round((hours[0]?.seconds ?? 0) / 3600),
    events: events.map((e) => ({
      name: e.eventName?.trim() || `${e.location} event`,
      date: formatInNZT(e.date, "yyyy-MM-dd"),
      location: e.location,
    })),
  };
}

/** Whether the volunteer has a video for `year`: any completed shift. */
export async function hasYearInReview(
  userId: string,
  year: number,
  now: Date = new Date()
): Promise<boolean> {
  const range = nzYearRange(year);
  const shift = await prisma.signup.findFirst({
    where: {
      userId,
      status: "CONFIRMED",
      shift: { start: { gte: range.start, lt: range.end }, end: { lt: now } },
    },
    select: { id: true },
  });
  return shift !== null;
}

/** How many people (any role) have a video for `year`. */
export async function countYearInReviewPeople(
  year: number,
  now: Date = new Date()
): Promise<number> {
  const range = nzYearRange(year);
  const people = await prisma.signup.groupBy({
    by: ["userId"],
    where: {
      status: "CONFIRMED",
      shift: { start: { gte: range.start, lt: range.end }, end: { lt: now } },
    },
  });
  return people.length;
}
