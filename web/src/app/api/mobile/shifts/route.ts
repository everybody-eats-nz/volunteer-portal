import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";

const DEFAULT_PAGE_SIZE = 15;

/**
 * GET /api/mobile/shifts
 *
 * Returns shifts categorized for the authenticated user:
 * - myShifts: upcoming shifts the user is signed up for (always returns all)
 * - available: upcoming shifts with open spots the user is NOT signed up for (paginated)
 * - past: past shifts the user attended (paginated)
 *
 * Pagination query params:
 * - limit: number of items per page (default 15)
 * - availableCursor: shift ID cursor for available shifts (omit for first page)
 * - pastCursor: signup ID cursor for past shifts (omit for first page)
 */
export async function GET(request: Request) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const { userId } = auth;

  // Fetch user's preferred locations for the client to default the filter
  const userRecord = await prisma.user.findUnique({
    where: { id: userId },
    select: { availableLocations: true },
  });
  let userPreferredLocations: string[] = [];
  if (userRecord?.availableLocations) {
    try {
      const parsed = JSON.parse(userRecord.availableLocations);
      if (Array.isArray(parsed)) {
        userPreferredLocations = parsed.filter(
          (item: unknown) => typeof item === "string" && (item as string).trim()
        );
      }
    } catch {
      // Not valid JSON — ignore
    }
  }

  const url = new URL(request.url);
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") ?? "") || DEFAULT_PAGE_SIZE, 1),
    50
  );
  const availableCursor = url.searchParams.get("availableCursor");
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

  // Fetch available upcoming shifts (paginated)
  const userSignedUpShiftIds = mySignups.map((s) => s.shift.id);

  const availableShifts = await prisma.shift.findMany({
    where: {
      start: { gte: now },
      id: { notIn: userSignedUpShiftIds.length > 0 ? userSignedUpShiftIds : undefined },
    },
    include: {
      shiftType: true,
      signups: { where: { status: "CONFIRMED" } },
    },
    orderBy: { start: "asc" },
    take: limit + 1, // Fetch one extra to detect if there are more
    ...(availableCursor
      ? { cursor: { id: availableCursor }, skip: 1 }
      : {}),
  });

  const hasMoreAvailable = availableShifts.length > limit;
  if (hasMoreAvailable) availableShifts.pop(); // Remove the extra item

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

  const filteredAvailable = availableShifts.filter(
    (s) => s.signups.length < s.capacity
  );

  return NextResponse.json({
    myShifts: mySignups.map((signup) =>
      toMobileShift(signup.shift, signup.status)
    ),
    available: filteredAvailable.map((s) => toMobileShift(s)),
    past: pastSignups.map((signup) =>
      toMobileShift(signup.shift, signup.status)
    ),
    availableNextCursor: hasMoreAvailable
      ? availableShifts[availableShifts.length - 1]?.id ?? null
      : null,
    pastNextCursor: hasMorePast
      ? pastSignups[pastSignups.length - 1]?.id ?? null
      : null,
    userPreferredLocations,
  });
}
