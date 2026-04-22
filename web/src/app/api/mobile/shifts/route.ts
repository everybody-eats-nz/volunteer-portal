import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";
import { getShiftDate, isAMShift } from "@/lib/concurrent-shifts";

const DEFAULT_PAGE_SIZE = 15;

/** How far ahead (in months) to include available shifts — covers the calendar window. */
const AVAILABLE_WINDOW_MONTHS = 3;

/**
 * GET /api/mobile/shifts
 *
 * Returns shifts categorized for the authenticated user:
 * - myShifts: upcoming shifts the user is signed up for (always returns all)
 * - available: upcoming shifts the user is NOT signed up for, within a 3-month window (unpaginated)
 * - past: past shifts the user attended (paginated)
 *
 * Pagination query params:
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

  // Fetch user's default location for the client to default the filter
  const userRecord = await prisma.user.findUnique({
    where: { id: userId },
    select: { defaultLocation: true },
  });
  const userDefaultLocation = userRecord?.defaultLocation ?? null;

  const url = new URL(request.url);
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") ?? "") || DEFAULT_PAGE_SIZE, 1),
    50
  );
  const pastCursor = url.searchParams.get("pastCursor");

  // Active signup statuses (not canceled/no-show/etc)
  const activeStatuses = ["CONFIRMED", "PENDING", "WAITLISTED", "REGULAR_PENDING"] as const;

  // Fetch upcoming shifts the user is signed up for (always all — typically small)
  const mySignups = await prisma.signup.findMany({
    where: {
      userId,
      status: { in: [...activeStatuses] },
      shift: { start: { gte: now } },
    },
    include: {
      shift: {
        include: {
          shiftType: true,
          signups: { where: { status: "CONFIRMED" } },
        },
      },
    },
    orderBy: { shift: { start: "asc" } },
  });

  // Fetch available upcoming shifts within the calendar window (unpaginated — bounded by date range)
  const userSignedUpShiftIds = mySignups.map((s) => s.shift.id);

  const availableWindowEnd = new Date(now);
  availableWindowEnd.setMonth(availableWindowEnd.getMonth() + AVAILABLE_WINDOW_MONTHS);

  const availableShifts = await prisma.shift.findMany({
    where: {
      start: { gte: now, lt: availableWindowEnd },
      id: { notIn: userSignedUpShiftIds.length > 0 ? userSignedUpShiftIds : undefined },
    },
    include: {
      shiftType: true,
      signups: { where: { status: "CONFIRMED" } },
    },
    orderBy: { start: "asc" },
  });

  // Fetch past shifts the user attended (paginated)
  const pastSignups = await prisma.signup.findMany({
    where: {
      userId,
      status: { in: ["CONFIRMED"] },
      shift: { end: { lt: now } },
    },
    include: {
      shift: {
        include: {
          shiftType: true,
          signups: { where: { status: "CONFIRMED" } },
        },
      },
    },
    orderBy: { shift: { start: "desc" } },
    take: limit + 1,
    ...(pastCursor
      ? { cursor: { id: pastCursor }, skip: 1 }
      : {}),
  });

  const hasMorePast = pastSignups.length > limit;
  if (hasMorePast) pastSignups.pop();

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
      signups: { id: string }[];
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
    signedUp: shift.signups.length,
    status: status ?? null,
    notes: shift.notes,
  });

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

  // Get user's friends
  const friendships = await prisma.friendship.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ userId }, { friendId: userId }],
    },
    select: { userId: true, friendId: true },
  });

  const friendIds = new Set<string>();
  for (const f of friendships) {
    friendIds.add(f.userId === userId ? f.friendId : f.userId);
  }

  type FriendSummary = { id: string; name: string; profilePhotoUrl: string | null };

  let periodFriends: Record<string, FriendSummary[]> = {};
  let shiftFriends: Record<string, FriendSummary[]> = {};

  if (friendIds.size > 0 && allUpcomingShiftIds.length > 0) {
    const friendSignups = await prisma.signup.findMany({
      where: {
        shiftId: { in: allUpcomingShiftIds },
        userId: { in: Array.from(friendIds) },
        status: { in: ["CONFIRMED", "PENDING", "REGULAR_PENDING"] },
      },
      select: {
        shiftId: true,
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
    });

    const periodMap = new Map<string, Map<string, FriendSummary>>();
    const shiftMap = new Map<string, Map<string, FriendSummary>>();

    for (const signup of friendSignups) {
      const friend: FriendSummary = {
        id: signup.user.id,
        name:
          signup.user.name ??
          [signup.user.firstName, signup.user.lastName].filter(Boolean).join(" ") ??
          "Volunteer",
        profilePhotoUrl: signup.user.profilePhotoUrl,
      };

      if (!shiftMap.has(signup.shiftId)) {
        shiftMap.set(signup.shiftId, new Map());
      }
      shiftMap.get(signup.shiftId)!.set(friend.id, friend);

      const periodKey = shiftPeriodMap.get(signup.shiftId);
      if (!periodKey) continue;
      if (!periodMap.has(periodKey)) {
        periodMap.set(periodKey, new Map());
      }
      periodMap.get(periodKey)!.set(friend.id, friend);
    }

    periodFriends = Object.fromEntries(
      Array.from(periodMap.entries()).map(([key, map]) => [key, Array.from(map.values())])
    );
    shiftFriends = Object.fromEntries(
      Array.from(shiftMap.entries()).map(([key, map]) => [key, Array.from(map.values())])
    );
  }

  return NextResponse.json({
    myShifts: mySignups.map((signup) =>
      toMobileShift(signup.shift, signup.status)
    ),
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
