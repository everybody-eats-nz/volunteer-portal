// City-level content for the public "Volunteer in <city>" SEO landing pages
// (`/volunteer` and `/volunteer/[city]`).
//
// These pages exist to rank for generic, non-branded local searches such as
// "volunteering Wellington" or "volunteer opportunities Auckland". Unlike the
// logged-in portal, every word here is crawlable, server-rendered, and pairs
// the keyword "volunteer" with a specific city name + suburb addresses — the
// thing the portal previously never said out loud.

import { prisma } from "@/lib/prisma";
import { cacheLife } from "next/cache";
import { getGoogleMapsUrl } from "@/lib/locations";
import {
  shiftCapacityCountSelect,
  getShiftEffectiveCount,
} from "@/lib/placeholder-utils";
import { formatInNZT } from "@/lib/timezone";

export interface Venue {
  /** Suburb / restaurant name, e.g. "Onehunga". Matches Shift.location. */
  name: string;
  address: string;
}

export interface VolunteerLocation {
  /** URL slug — `/volunteer/<slug>`. */
  slug: string;
  /** City as people search for it, e.g. "Wellington", "Auckland". */
  city: string;
  /** Te Reo Māori name for the rohe, woven into the copy. */
  reoName: string;
  /** Shift.location values in the DB that belong to this city. */
  shiftLocations: string[];
  /** Restaurants in this city. */
  venues: Venue[];
  /** 1–2 sentence hero intro — written distinctly per city (no thin dupes). */
  intro: string;
  /** "What you'd do" — short, city-flavoured paragraph. */
  about: string;
  /** Getting-there / when-we're-open note, unique per city. */
  gettingThere: string;
}

/** Volunteer roles offered across every restaurant. Shared, kept generic. */
export const VOLUNTEER_ROLES = [
  {
    title: "Kitchen prep",
    copy: "Turn rescued ingredients into the building blocks of a three-course meal — chopping, portioning and prepping alongside our chefs.",
  },
  {
    title: "Front of house",
    copy: "Welcome diners, set the tables and host the room. The friendly face that makes everyone feel part of the whānau.",
  },
  {
    title: "Service & pack-down",
    copy: "Plate up, run dishes and reset the restaurant after service. The buzz of a full dining room in full swing.",
  },
  {
    title: "Dishwashing",
    copy: "Keep the kitchen moving and the plates flowing. Unsung, essential, and weirdly satisfying.",
  },
] as const;

export const VOLUNTEER_LOCATIONS: VolunteerLocation[] = [
  {
    slug: "wellington",
    city: "Wellington",
    reoName: "Te Whanganui-a-Tara",
    shiftLocations: ["Wellington"],
    venues: [
      { name: "Wellington", address: "60 Dixon Street, Te Aro, Wellington" },
    ],
    intro:
      "Lend a hand at our Te Aro restaurant and help turn rescued kai into restaurant-quality meals for the Wellington community — no experience or long-term commitment needed.",
    about:
      "Our Wellington restaurant on Dixon Street serves a three-course meal at shared tables several evenings a week, on a pay-what-you-can basis. Volunteers keep the whole place running, from the kitchen to the dining room.",
    gettingThere:
      "We're right in the heart of Te Aro at 60 Dixon Street — a few minutes' walk from Courtenay Place and Cuba Street, and easy to reach by bus from across the city.",
  },
  {
    slug: "auckland",
    city: "Auckland",
    reoName: "Tāmaki Makaurau",
    shiftLocations: ["Glen Innes", "Onehunga"],
    venues: [
      { name: "Glen Innes", address: "133 Line Road, Glen Innes, Auckland" },
      { name: "Onehunga", address: "306 Onehunga Mall, Onehunga, Auckland" },
    ],
    intro:
      "Volunteer at our Glen Innes or Onehunga restaurants and help share good food, not waste, with your local Auckland community — come as you are, no experience required.",
    about:
      "Everybody Eats runs two restaurants across Tāmaki Makaurau — in Glen Innes and Onehunga. Both serve a three-course meal at shared tables on a pay-what-you-can basis, and both rely on volunteers for every part of the night.",
    gettingThere:
      "Find us in Glen Innes (133 Line Road) and Onehunga (306 Onehunga Mall) — both close to train and bus links, with parking nearby. Pick whichever restaurant is closest to you.",
  },
];

export function getVolunteerLocation(slug: string): VolunteerLocation | undefined {
  return VOLUNTEER_LOCATIONS.find((l) => l.slug === slug);
}

export function venueMapsUrl(venue: Venue): string {
  return getGoogleMapsUrl(venue.address);
}

/**
 * Count upcoming, published shifts across a city's restaurants. Cached hourly
 * so the number renders into the static HTML (crawlable) without hammering the
 * DB — freshness within the hour is plenty for an SEO landing page.
 */
export async function getUpcomingShiftCount(
  shiftLocations: string[]
): Promise<number> {
  "use cache";
  cacheLife("hours");

  return prisma.shift.count({
    where: {
      location: { in: shiftLocations },
      start: { gte: new Date() },
    },
  });
}

export interface UpcomingShift {
  id: string;
  /** Shift-type name, e.g. "Front of House" — the volunteer's "role". */
  role: string;
  /** Which restaurant (suburb) the shift is at. */
  venue: string;
  /** Pre-formatted NZ-time labels, e.g. "Sun 22 Jun" and "5:30pm–9:00pm". */
  dateLabel: string;
  timeLabel: string;
  spotsAvailable: number;
}

// Statuses that occupy a spot — mirrors the public shifts listing so the
// "spots left" figure here matches what volunteers see on /shifts.
const SPOT_TAKING_STATUSES = ["CONFIRMED", "PENDING", "REGULAR_PENDING"] as const;

/**
 * Real upcoming shifts for a city's restaurants, soonest first. Powers the
 * "Find your role" section with concrete, bookable shifts (role + venue + date
 * + spots) instead of static copy. Cached hourly so it stays in the static
 * HTML — fresh enough for an SEO landing page, and never per-request heavy.
 */
export async function getUpcomingShifts(
  shiftLocations: string[],
  limit = 6
): Promise<UpcomingShift[]> {
  "use cache";
  cacheLife("hours");

  const shifts = await prisma.shift.findMany({
    where: {
      location: { in: shiftLocations },
      start: { gte: new Date() },
    },
    orderBy: { start: "asc" },
    take: limit,
    select: {
      id: true,
      start: true,
      end: true,
      location: true,
      capacity: true,
      shiftType: { select: { name: true } },
      _count: shiftCapacityCountSelect(SPOT_TAKING_STATUSES),
    },
  });

  // Format the NZ-time labels here, inside the cache scope. Reading the clock
  // (which date formatting does) is only allowed in a cached/dynamic context
  // under Next's cacheComponents — doing it in the page's render would break
  // the static prerender.
  return shifts.map((shift) => ({
    id: shift.id,
    role: shift.shiftType.name,
    venue: shift.location ?? "",
    dateLabel: formatInNZT(shift.start, "EEE d MMM"),
    timeLabel: `${formatInNZT(shift.start, "h:mmaaa")}–${formatInNZT(
      shift.end,
      "h:mmaaa"
    )}`,
    spotsAvailable: Math.max(0, shift.capacity - getShiftEffectiveCount(shift)),
  }));
}
