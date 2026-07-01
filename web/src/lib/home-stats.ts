import { prisma } from "@/lib/prisma";
import {
  getActiveVolunteerCount,
  getConfirmedVolunteerHours,
} from "@/lib/impact-stats";
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

  const [volunteers, mealsAggregate, hoursLogged, openShiftsRaw, weekShifts] =
    await Promise.all([
      // Volunteers: distinct people who have actually done a shift, not
      // everyone who ever registered. Shared with the public impact endpoint.
      getActiveVolunteerCount(now),
      prisma.mealsServed.aggregate({
        _sum: { mealsServed: true },
      }),
      // Hours logged: sum of completed CONFIRMED signups' shift duration.
      // Computed in SQL (no row cap) — shared with the public impact endpoint.
      getConfirmedVolunteerHours(now),
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
