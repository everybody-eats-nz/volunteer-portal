import { prisma } from "@/lib/prisma";
import { nowInNZT } from "@/lib/timezone";

export interface DayHours {
  dayOfWeek: number; // 0=Sun .. 6=Sat
  isOpen: boolean;
  openTime: string; // "HH:mm"
  closeTime: string;
}

export interface LocationHours {
  location: string;
  hours: DayHours[]; // length 7, indexed by dayOfWeek
}

const DEFAULT_OPEN = "09:00";
const DEFAULT_CLOSE = "17:00";

function defaultDay(dayOfWeek: number): DayHours {
  // Closed on weekends by default; open weekdays.
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  return {
    dayOfWeek,
    isOpen: !isWeekend,
    openTime: DEFAULT_OPEN,
    closeTime: DEFAULT_CLOSE,
  };
}

function fillWeek(rows: { dayOfWeek: number; isOpen: boolean; openTime: string; closeTime: string }[]): DayHours[] {
  const byDay = new Map(rows.map((r) => [r.dayOfWeek, r]));
  return Array.from({ length: 7 }, (_, i) => byDay.get(i) ?? defaultDay(i));
}

export async function getHoursForLocation(
  location: string
): Promise<LocationHours> {
  const rows = await prisma.messagingHours.findMany({
    where: { location },
    orderBy: { dayOfWeek: "asc" },
  });
  return { location, hours: fillWeek(rows) };
}

export async function getAllLocationHours(): Promise<LocationHours[]> {
  const locations = await prisma.location.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { name: true },
  });
  const all = await prisma.messagingHours.findMany({
    orderBy: [{ location: "asc" }, { dayOfWeek: "asc" }],
  });
  const grouped = new Map<string, typeof all>();
  for (const row of all) {
    const list = grouped.get(row.location) ?? [];
    list.push(row);
    grouped.set(row.location, list);
  }
  return locations.map((loc) => ({
    location: loc.name,
    hours: fillWeek(grouped.get(loc.name) ?? []),
  }));
}

interface UpsertHoursArgs {
  location: string;
  hours: Pick<DayHours, "dayOfWeek" | "isOpen" | "openTime" | "closeTime">[];
  updatedBy?: string;
}

export async function upsertHoursForLocation(
  args: UpsertHoursArgs
): Promise<LocationHours> {
  for (const h of args.hours) {
    if (!isValidTime(h.openTime) || !isValidTime(h.closeTime)) {
      throw new Error(
        `Invalid time on day ${h.dayOfWeek}: ${h.openTime}–${h.closeTime}`
      );
    }
    if (h.dayOfWeek < 0 || h.dayOfWeek > 6) {
      throw new Error(`Invalid dayOfWeek: ${h.dayOfWeek}`);
    }
  }

  await prisma.$transaction(
    args.hours.map((h) =>
      prisma.messagingHours.upsert({
        where: {
          location_dayOfWeek: {
            location: args.location,
            dayOfWeek: h.dayOfWeek,
          },
        },
        update: {
          isOpen: h.isOpen,
          openTime: h.openTime,
          closeTime: h.closeTime,
          updatedBy: args.updatedBy,
        },
        create: {
          location: args.location,
          dayOfWeek: h.dayOfWeek,
          isOpen: h.isOpen,
          openTime: h.openTime,
          closeTime: h.closeTime,
          updatedBy: args.updatedBy,
        },
      })
    )
  );

  return getHoursForLocation(args.location);
}

function isValidTime(t: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export interface OpenStatus {
  isOpenNow: boolean;
  todayHours: DayHours;
  nextOpenLabel?: string;
}

/**
 * Returns whether messaging is "open" right now in NZ time, plus a
 * human-readable hint for off-hours (e.g. "Opens 9 am tomorrow").
 */
export function evaluateOpenStatus(hours: LocationHours): OpenStatus {
  const now = nowInNZT();
  const dayOfWeek = now.getDay();
  const today = hours.hours[dayOfWeek];
  const minutesNow = now.getHours() * 60 + now.getMinutes();

  let isOpenNow = false;
  if (today.isOpen) {
    const open = timeToMinutes(today.openTime);
    const close = timeToMinutes(today.closeTime);
    isOpenNow = minutesNow >= open && minutesNow < close;
  }

  let nextOpenLabel: string | undefined;
  if (!isOpenNow) {
    nextOpenLabel = formatNextOpen(hours.hours, dayOfWeek, minutesNow);
  }

  return { isOpenNow, todayHours: today, nextOpenLabel };
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function formatNextOpen(
  week: DayHours[],
  todayIdx: number,
  minutesNow: number
): string | undefined {
  // Today before open?
  const today = week[todayIdx];
  if (today.isOpen && timeToMinutes(today.openTime) > minutesNow) {
    return `Opens ${humanTime(today.openTime)} today`;
  }

  for (let offset = 1; offset <= 7; offset++) {
    const idx = (todayIdx + offset) % 7;
    const day = week[idx];
    if (!day.isOpen) continue;
    if (offset === 1) return `Opens ${humanTime(day.openTime)} tomorrow`;
    return `Opens ${humanTime(day.openTime)} ${DAY_NAMES[idx]}`;
  }
  return undefined;
}

function humanTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h < 12 ? "am" : "pm";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour12} ${period}` : `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

/**
 * Resolve a volunteer's "primary" location used for the off-hours hint.
 * Prefers their `defaultLocation`, falling back to the most recent shift.
 */
export async function getPrimaryLocationForVolunteer(
  volunteerId: string
): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: volunteerId },
    select: { defaultLocation: true },
  });
  if (user?.defaultLocation) return user.defaultLocation;

  const recent = await prisma.signup.findFirst({
    where: { userId: volunteerId },
    orderBy: { createdAt: "desc" },
    select: { shift: { select: { location: true } } },
  });
  return recent?.shift?.location ?? null;
}
