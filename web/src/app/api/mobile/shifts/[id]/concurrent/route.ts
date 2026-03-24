import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";
import { getConcurrentShifts, getShiftDate, isAMShift } from "@/lib/concurrent-shifts";

/**
 * GET /api/mobile/shifts/[id]/concurrent
 *
 * Returns:
 * - concurrentShifts: other shifts at same location/date/period (for backup selection)
 * - friends: friends signed up for ANY shift at that location/date/period,
 *   including the current shift (regardless of shift type / role)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = auth;
  const { id: shiftId } = await params;

  try {
    // Get the shift to determine date/period/location
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      select: { id: true, start: true, location: true },
    });

    if (!shift) {
      return NextResponse.json(
        { concurrentShifts: [], friends: [] },
        { status: 200 }
      );
    }

    // Get concurrent shifts (for backup selection)
    const concurrentShifts = await getConcurrentShifts(shiftId);

    // Find friends across ALL shifts at this location/date/period
    const shiftDate = getShiftDate(shift.start);
    const shiftIsAM = isAMShift(shift.start);

    // Get all shifts at the same location (including this one)
    const allShiftsAtLocation = await prisma.shift.findMany({
      where: { location: shift.location },
      select: { id: true, start: true, shiftType: { select: { name: true } } },
    });

    // Filter to same date + same AM/PM
    const periodShiftIds = allShiftsAtLocation
      .filter((s) => {
        return getShiftDate(s.start) === shiftDate && isAMShift(s.start) === shiftIsAM;
      })
      .map((s) => ({ id: s.id, shiftTypeName: s.shiftType.name }));

    // Get the user's accepted friendships
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

    if (friendIds.size === 0) {
      return NextResponse.json({ concurrentShifts, friends: [] });
    }

    // Find signups by friends on any of these period shifts
    const friendSignups = await prisma.signup.findMany({
      where: {
        shiftId: { in: periodShiftIds.map((s) => s.id) },
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

    // Build a map of shiftId → shiftTypeName for labelling
    const shiftTypeMap = new Map(periodShiftIds.map((s) => [s.id, s.shiftTypeName]));

    // Deduplicate friends (a friend might be on multiple shifts theoretically)
    const seen = new Set<string>();
    const friends = friendSignups
      .filter((s) => {
        if (seen.has(s.user.id)) return false;
        seen.add(s.user.id);
        return true;
      })
      .map((s) => ({
        id: s.user.id,
        name:
          s.user.name ??
          [s.user.firstName, s.user.lastName].filter(Boolean).join(" ") ??
          "Volunteer",
        profilePhotoUrl: s.user.profilePhotoUrl,
        shiftTypeName: shiftTypeMap.get(s.shiftId) ?? null,
      }));

    return NextResponse.json({ concurrentShifts, friends });
  } catch (error) {
    console.error("Error fetching concurrent shifts:", error);
    return NextResponse.json({ concurrentShifts: [], friends: [] }, { status: 200 });
  }
}
