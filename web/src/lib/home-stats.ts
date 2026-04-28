import { prisma } from "@/lib/prisma";

export type HomeStats = {
  volunteers: number;
  mealsServed: number;
  hoursLogged: number;
  openShiftsCount: number;
  openSpots: number;
  activeLocations: number;
  upcomingShifts: UpcomingShift[];
  recentActivity: RecentActivityItem[];
  locationStatus: LocationStatus[];
  shiftsThisWeek: number;
  generatedAt: string;
};

export type UpcomingShift = {
  id: string;
  start: Date;
  end: Date;
  location: string | null;
  shiftType: string;
  capacity: number;
  confirmed: number;
  spotsLeft: number;
};

export type RecentActivityItem = {
  id: string;
  firstName: string;
  shiftType: string;
  location: string | null;
  start: Date;
  createdAt: Date;
};

export type LocationStatus = {
  name: string;
  openShifts: number;
  spotsLeft: number;
};

// Public-facing location list — only the three customer-facing restaurants
// are shown on the homepage. "Active locations" count still reflects all
// active locations in the database.
const PUBLIC_LOCATION_NAMES = ["Wellington", "Glen Innes", "Onehunga"] as const;

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

export async function getHomeStats(): Promise<HomeStats> {
  const now = new Date();
  const weekStart = startOfWeekUTC(now);
  const weekEnd = endOfWeekUTC(now);

  const [
    volunteers,
    mealsAggregate,
    completedSignups,
    openShiftsRaw,
    activeLocations,
    upcomingShifts,
    recentSignups,
    weekShifts,
    locationsList,
  ] = await Promise.all([
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
        location: true,
        signups: {
          where: { status: "CONFIRMED" },
          select: { id: true },
        },
      },
    }),
    prisma.location.count({ where: { isActive: true } }),
    prisma.shift.findMany({
      where: { start: { gte: now } },
      orderBy: { start: "asc" },
      take: 6,
      include: {
        shiftType: { select: { name: true } },
        signups: {
          where: { status: "CONFIRMED" },
          select: { id: true },
        },
      },
    }),
    prisma.signup.findMany({
      where: {
        status: "CONFIRMED",
        shift: { start: { gte: now } },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        user: { select: { firstName: true, name: true } },
        shift: {
          select: {
            start: true,
            location: true,
            shiftType: { select: { name: true } },
          },
        },
      },
    }),
    prisma.shift.count({
      where: { start: { gte: weekStart, lt: weekEnd } },
    }),
    prisma.location.findMany({
      where: { isActive: true, name: { in: [...PUBLIC_LOCATION_NAMES] } },
      select: { name: true },
    }),
  ]);

  // Hours logged: sum of completed CONFIRMED signups' shift duration (hours)
  let hoursLoggedMs = 0;
  for (const s of completedSignups) {
    hoursLoggedMs += s.shift.end.getTime() - s.shift.start.getTime();
  }
  const hoursLogged = Math.round(hoursLoggedMs / (1000 * 60 * 60));

  // Open shifts derived
  const openShiftsCount = openShiftsRaw.filter(
    (s) => s.signups.length < s.capacity
  ).length;
  const openSpots = openShiftsRaw.reduce(
    (sum, s) => sum + Math.max(0, s.capacity - s.signups.length),
    0
  );

  // Per-location status — only the three customer-facing restaurants,
  // ordered canonically so the panel always reads the same way.
  const activeNames = new Set(locationsList.map((l) => l.name));
  const locationStatus: LocationStatus[] = PUBLIC_LOCATION_NAMES.filter((n) =>
    activeNames.has(n)
  ).map((name) => {
    const shifts = openShiftsRaw.filter((s) => s.location === name);
    const open = shifts.filter((s) => s.signups.length < s.capacity).length;
    const spots = shifts.reduce(
      (sum, s) => sum + Math.max(0, s.capacity - s.signups.length),
      0
    );
    return { name, openShifts: open, spotsLeft: spots };
  });

  const upcoming: UpcomingShift[] = upcomingShifts.map((s) => ({
    id: s.id,
    start: s.start,
    end: s.end,
    location: s.location,
    shiftType: s.shiftType.name,
    capacity: s.capacity,
    confirmed: s.signups.length,
    spotsLeft: Math.max(0, s.capacity - s.signups.length),
  }));

  const activity: RecentActivityItem[] = recentSignups.map((s) => {
    const fallback = (s.user.name ?? "").trim().split(/\s+/)[0] || "Someone";
    return {
      id: s.id,
      firstName: s.user.firstName ?? fallback,
      shiftType: s.shift.shiftType.name,
      location: s.shift.location,
      start: s.shift.start,
      createdAt: s.createdAt,
    };
  });

  return {
    volunteers,
    mealsServed: mealsAggregate._sum.mealsServed ?? 0,
    hoursLogged,
    openShiftsCount,
    openSpots,
    activeLocations,
    upcomingShifts: upcoming,
    recentActivity: activity,
    locationStatus,
    shiftsThisWeek: weekShifts,
    generatedAt: now.toISOString(),
  };
}
