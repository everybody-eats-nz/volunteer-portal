import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";
import { getLiveLocations } from "@/lib/live-locations";
import { getWaitlistCounts } from "@/lib/waitlist.server";
import { getShiftDate, isAMShift } from "@/lib/concurrent-shifts";
import {
  getShiftEffectiveCount,
  shiftCapacityCountSelect,
  SPOT_TAKING_STATUSES,
} from "@/lib/placeholder-utils";

const DEFAULT_PAGE_SIZE = 15;

/** How far ahead (in months) to include available shifts — covers the calendar window. */
const AVAILABLE_WINDOW_MONTHS = 3;

/**
 * How far ahead `scope=home` looks. The home tab only renders a rolling
 * week of "volunteers needed", so there's no reason to ship it a quarter.
 */
const HOME_WINDOW_DAYS = 7;

/**
 * GET /api/mobile/shifts
 *
 * Returns shifts categorized for the authenticated user:
 * - myShifts: upcoming shifts the user is signed up for (always returns all)
 * - available: upcoming shifts the user is NOT signed up for, within a 3-month window (unpaginated)
 * - past: past shifts the user attended (paginated)
 *
 * Query params:
 * - scope: "home" trims the response to what the home tab actually renders —
 *   a week of available shifts at the user's default location, no past shifts,
 *   no per-shift friend map. The full response is several hundred times larger
 *   at production data volumes and the home tab discards nearly all of it.
 *   Omit the param for the full payload; older app builds that don't know
 *   about it keep getting exactly what they got before.
 * - limit: number of items per page for past (default 15)
 * - pastCursor: signup ID cursor for past shifts (omit for first page)
 */
export async function GET(request: Request) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const { userId } = auth;

  const url = new URL(request.url);
  const isHomeScope = url.searchParams.get("scope") === "home";
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") ?? "") || DEFAULT_PAGE_SIZE, 1),
    50
  );
  const pastCursor = url.searchParams.get("pastCursor");

  // Active signup statuses (not canceled/no-show/etc)
  const activeStatuses = ["CONFIRMED", "PENDING", "WAITLISTED", "REGULAR_PENDING"] as const;

  // The home scope filters available shifts to the user's own restaurant, so
  // it needs the profile row before it can build that query. It's a primary-key
  // lookup, and every query it gates is small in this scope.
  const userRecord = await prisma.user.findUnique({
    where: { id: userId },
    select: { defaultLocation: true },
  });
  const userDefaultLocation = userRecord?.defaultLocation ?? null;

  const availableWindowEnd = new Date(now);
  if (isHomeScope) {
    availableWindowEnd.setDate(availableWindowEnd.getDate() + HOME_WINDOW_DAYS);
  } else {
    availableWindowEnd.setMonth(availableWindowEnd.getMonth() + AVAILABLE_WINDOW_MONTHS);
  }

  // Everything the response needs that doesn't depend on another query, in one
  // round trip. This used to be six sequential awaits — on a mobile client
  // that latency is paid on every home-tab load.
  const [mySignups, windowShifts, pastSignups, friendships, liveLocations] =
    await Promise.all([
      // Upcoming shifts the user is signed up for (always all — typically small).
      // Bucket by `end >= now` (not `start`) so a shift that is currently in progress
      // (started but not yet ended) still appears in the user's shifts. This mirrors the
      // `past` query below (`end < now`), so every signup falls into exactly one bucket
      // with no gap — otherwise an in-progress confirmed shift vanishes from the app.
      prisma.signup.findMany({
        where: {
          userId,
          status: { in: [...activeStatuses] },
          shift: { end: { gte: now } },
        },
        include: {
          shift: {
            include: {
              shiftType: true,
              _count: shiftCapacityCountSelect(SPOT_TAKING_STATUSES),
            },
          },
        },
        orderBy: { shift: { start: "asc" } },
      }),

      // Every upcoming shift in the calendar window (unpaginated — bounded by
      // date range). The user's own signups are subtracted in memory below
      // rather than with a `NOT IN`, so this doesn't have to wait on the
      // signup query and Postgres doesn't get handed a growing id list.
      prisma.shift.findMany({
        where: {
          start: { gte: now, lt: availableWindowEnd },
          // Home only surfaces shifts the volunteer could realistically take;
          // other restaurants aren't actionable for them. No filter when they
          // haven't picked a home restaurant yet.
          ...(isHomeScope && userDefaultLocation
            ? { location: userDefaultLocation }
            : {}),
        },
        include: {
          shiftType: true,
          _count: shiftCapacityCountSelect(SPOT_TAKING_STATUSES),
        },
        // Tie-break on id: a location runs several roles at the same start
        // time, and ordering on `start` alone lets Postgres return them in
        // whatever order the chosen plan produces — so the list visibly
        // reshuffles between refreshes.
        orderBy: [{ start: "asc" }, { id: "asc" }],
      }),

      // Past shifts the user attended (paginated). The home tab never renders
      // them, so the home scope skips the query and returns an empty page.
      isHomeScope
        ? []
        : prisma.signup.findMany({
            where: {
              userId,
              status: { in: ["CONFIRMED"] },
              shift: { end: { lt: now } },
            },
            include: {
              shift: {
                include: {
                  shiftType: true,
                  _count: shiftCapacityCountSelect(SPOT_TAKING_STATUSES),
                },
              },
            },
            orderBy: { shift: { start: "desc" } },
            take: limit + 1,
            ...(pastCursor
              ? { cursor: { id: pastCursor }, skip: 1 }
              : {}),
          }),

      // The user's friends, for the friend maps built further down.
      prisma.friendship.findMany({
        where: {
          status: "ACCEPTED",
          OR: [{ userId }, { friendId: userId }],
        },
        select: { userId: true, friendId: true },
      }),

      // Locations volunteers can browse (live = has upcoming shifts, not
      // disabled), with the "New" flag for recently launched restaurants.
      getLiveLocations(),
    ]);

  const userSignedUpShiftIds = new Set(mySignups.map((s) => s.shift.id));
  const availableShifts = windowShifts.filter(
    (shift) => !userSignedUpShiftIds.has(shift.id)
  );

  const hasMorePast = pastSignups.length > limit;
  if (hasMorePast) pastSignups.pop();

  // Build periodFriends: friends signed up for shifts in each date+period
  // Collect all upcoming shift IDs (myShifts + available)
  const allUpcomingShiftIds = [
    ...mySignups.map((s) => s.shift.id),
    ...availableShifts.map((s) => s.id),
  ];

  // Build a map of shiftId → date+period key
  const shiftPeriodMap = new Map<string, string>();
  for (const signup of mySignups) {
    const date = getShiftDate(signup.shift.start);
    const period = isAMShift(signup.shift.start) ? "DAY" : "EVE";
    shiftPeriodMap.set(signup.shift.id, `${date}-${period}`);
  }
  for (const shift of availableShifts) {
    const date = getShiftDate(shift.start);
    const period = isAMShift(shift.start) ? "DAY" : "EVE";
    shiftPeriodMap.set(shift.id, `${date}-${period}`);
  }

  const friendIds = new Set<string>();
  for (const f of friendships) {
    friendIds.add(f.userId === userId ? f.friendId : f.userId);
  }

  type FriendSummary = {
    id: string;
    name: string;
    profilePhotoUrl: string | null;
    isFriend: boolean;
    /**
     * Whether this volunteer holds a spot or is still waiting on an admin.
     * REGULAR_PENDING is folded into PENDING — the distinction is an admin one
     * and means nothing to the volunteer waiting to hear back.
     */
    status: "CONFIRMED" | "PENDING";
  };

  // Second (and last) round trip: both of these key off the same upcoming
  // shift ids, so neither needs to wait on the other.
  //
  // Waitlist sizes let the app show how many volunteers are already waiting
  // without a round trip per shift. Past shifts are left out — the number only
  // informs a live decision.
  //
  // visibleSignups includes signups by either actual friends (any non-PRIVATE
  // visibility) or users who set their profile to PUBLIC visibility. This
  // matches the web shifts page logic.
  const [waitlistCounts, visibleSignups] = await Promise.all([
    getWaitlistCounts(allUpcomingShiftIds),
    allUpcomingShiftIds.length > 0
      ? prisma.signup.findMany({
          where: {
            shiftId: { in: allUpcomingShiftIds },
            status: { in: ["CONFIRMED", "PENDING", "REGULAR_PENDING"] },
            userId: { not: userId },
            user: {
              OR: [
                { friendVisibility: "PUBLIC" },
                ...(friendIds.size > 0
                  ? [
                      {
                        friendVisibility: "FRIENDS_ONLY" as const,
                        id: { in: Array.from(friendIds) },
                      },
                    ]
                  : []),
              ],
            },
          },
          select: {
            shiftId: true,
            status: true,
            user: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
                profilePhotoUrl: true,
              },
            },
          },
        })
      : [],
  ]);

  // Transform to the mobile app's Shift shape
  const toMobileShift = (
    shift: {
      id: string;
      start: Date;
      end: Date;
      location: string | null;
      capacity: number;
      notes: string | null;
      shiftType: { id: string; name: string; description: string | null };
      _count: { signups: number; placeholders: number };
    },
    status?: string | null
  ) => ({
    id: shift.id,
    shiftType: {
      id: shift.shiftType.id,
      name: shift.shiftType.name,
      description: shift.shiftType.description ?? "",
    },
    start: shift.start.toISOString(),
    end: shift.end.toISOString(),
    location: shift.location ?? "TBC",
    capacity: shift.capacity,
    signedUp: getShiftEffectiveCount(shift),
    waitlistCount: waitlistCounts.get(shift.id) ?? 0,
    status: status ?? null,
    notes: shift.notes,
  });

  const periodMap = new Map<string, Map<string, FriendSummary>>();
  const shiftMap = new Map<string, Map<string, FriendSummary>>();

  // A volunteer can hold more than one role in the same Day/Evening period,
  // so the period map dedupes by user. A confirmed spot on any of those roles
  // means they are on that session — don't let a second, still-pending signup
  // overwrite it and report them as waiting.
  const addFriend = (
    map: Map<string, Map<string, FriendSummary>>,
    key: string,
    friend: FriendSummary
  ) => {
    if (!map.has(key)) map.set(key, new Map());
    const bucket = map.get(key)!;
    const existing = bucket.get(friend.id);
    if (existing?.status === "CONFIRMED") return;
    bucket.set(friend.id, friend);
  };

  for (const signup of visibleSignups) {
    const friend: FriendSummary = {
      id: signup.user.id,
      name:
        signup.user.name ??
        [signup.user.firstName, signup.user.lastName].filter(Boolean).join(" ") ??
        "Volunteer",
      profilePhotoUrl: signup.user.profilePhotoUrl,
      isFriend: friendIds.has(signup.user.id),
      status: signup.status === "CONFIRMED" ? "CONFIRMED" : "PENDING",
    };

    // shiftFriends powers the Shifts tab's per-role list and calendar dots.
    // Home reads only periodFriends, and the two maps hold the same friend
    // objects duplicated across different keys — so home skips one of them.
    if (!isHomeScope) addFriend(shiftMap, signup.shiftId, friend);

    const periodKey = shiftPeriodMap.get(signup.shiftId);
    if (!periodKey) continue;
    addFriend(periodMap, periodKey, friend);
  }

  const periodFriends = Object.fromEntries(
    Array.from(periodMap.entries()).map(([key, map]) => [key, Array.from(map.values())])
  );
  const shiftFriends = Object.fromEntries(
    Array.from(shiftMap.entries()).map(([key, map]) => [key, Array.from(map.values())])
  );

  return NextResponse.json({
    myShifts: mySignups.map((signup) =>
      toMobileShift(signup.shift, signup.status)
    ),
    locations: liveLocations.map(({ name, isNew }) => ({ name, isNew })),
    available: availableShifts.map((s) => toMobileShift(s)),
    past: pastSignups.map((signup) =>
      toMobileShift(signup.shift, signup.status)
    ),
    pastNextCursor: hasMorePast
      ? pastSignups[pastSignups.length - 1]?.id ?? null
      : null,
    userDefaultLocation,
    periodFriends,
    shiftFriends,
  });
}
