import { prisma } from "@/lib/prisma";
import {
  getShiftEffectiveCount,
  shiftCapacityCountSelect,
} from "@/lib/placeholder-utils";

export type HomeStats = {
  volunteers: number;
  mealsServed: number;
  hoursLogged: number;
  openShiftsCount: number;
  openSpots: number;
  shiftsThisWeek: number;
};

const startOfWeekUTC = (now: Date) => {
  const day = now.getUTCDay();
  const diff = (day + 6) % 7; // Monday as week start
  const start = new Date(now);
  start.setUTCDate(now.getUTCDate() - diff);
  start.setUTCHours(0, 0, 0, 0);
  return start;
};

const endOfWeekUTC = (now: Date) => {
  const start = startOfWeekUTC(now);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  return end;
};

/** Aggregate impact numbers shown on the public landing page. */
export async function getHomeStats(): Promise<HomeStats> {
  const now = new Date();
  const weekStart = startOfWeekUTC(now);
  const weekEnd = endOfWeekUTC(now);

  const [volunteers, mealsAggregate, completedSignups, openShiftsRaw, weekShifts] =
    await Promise.all([
      prisma.user.count({
        where: { role: "VOLUNTEER", archivedAt: null },
      }),
      prisma.mealsServed.aggregate({
        _sum: { mealsServed: true },
      }),
      prisma.signup.findMany({
        where: {
          status: "CONFIRMED",
          shift: { end: { lt: now } },
        },
        select: {
          shift: { select: { start: true, end: true } },
        },
        take: 20000,
      }),
      prisma.shift.findMany({
        where: { start: { gte: now } },
        select: {
          id: true,
          capacity: true,
          _count: shiftCapacityCountSelect(["CONFIRMED"]),
        },
      }),
      prisma.shift.count({
        where: { start: { gte: weekStart, lt: weekEnd } },
      }),
    ]);

  // Hours logged: sum of completed CONFIRMED signups' shift duration (hours)
  let hoursLoggedMs = 0;
  for (const s of completedSignups) {
    hoursLoggedMs += s.shift.end.getTime() - s.shift.start.getTime();
  }
  const hoursLogged = Math.round(hoursLoggedMs / (1000 * 60 * 60));

  const openShiftsCount = openShiftsRaw.filter(
    (s) => getShiftEffectiveCount(s) < s.capacity
  ).length;
  const openSpots = openShiftsRaw.reduce(
    (sum, s) => sum + Math.max(0, s.capacity - getShiftEffectiveCount(s)),
    0
  );

  return {
    volunteers,
    mealsServed: mealsAggregate._sum.mealsServed ?? 0,
    hoursLogged,
    openShiftsCount,
    openSpots,
    shiftsThisWeek: weekShifts,
  };
}
