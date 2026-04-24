import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";

/**
 * GET /api/mobile/shifts/[id]
 *
 * Returns detailed shift information for the mobile app, including:
 * - Basic shift info (id, start, end, location, capacity, notes, shiftType)
 * - signedUp count (CONFIRMED signups)
 * - The current user's signup status for this shift (if any)
 * - List of signups with friend status
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { userId } = auth;

  // Fetch the shift with all related data
  const shift = await prisma.shift.findUnique({
    where: { id },
    include: {
      shiftType: true,
      signups: {
        where: {
          status: {
            in: ["CONFIRMED", "PENDING", "WAITLISTED", "REGULAR_PENDING"],
          },
        },
        include: {
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
      },
    },
  });

  if (!shift) {
    return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  }

  // Get the current user's friendship data to determine who is a friend
  const friendships = await prisma.friendship.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ userId }, { friendId: userId }],
    },
    select: {
      userId: true,
      friendId: true,
    },
  });

  // Build a set of friend IDs
  const friendIds = new Set<string>();
  for (const f of friendships) {
    if (f.userId === userId) {
      friendIds.add(f.friendId);
    } else {
      friendIds.add(f.userId);
    }
  }

  // Find the current user's signup for this shift (any active status)
  const userSignup = shift.signups.find((s) => s.userId === userId);
  const userStatus = userSignup?.status ?? null;

  // Count confirmed signups
  const signedUpCount = shift.signups.filter(
    (s) => s.status === "CONFIRMED"
  ).length;

  // Build signups list (all active signups) for the "Who's on this mahi" section
  const signups = shift.signups.map((s) => {
    const displayName =
      s.user.name ??
      [s.user.firstName, s.user.lastName].filter(Boolean).join(" ") ??
      "Volunteer";

    return {
      id: s.user.id,
      name: s.user.id === userId ? "You" : displayName,
      profilePhotoUrl: s.user.profilePhotoUrl,
      isFriend: friendIds.has(s.user.id),
    };
  });

  return NextResponse.json({
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
    signedUp: signedUpCount,
    status: userStatus,
    notes: shift.notes,
    signups,
  });
}
