import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { subMonths } from "date-fns";

const SHARED_SHIFTS_THRESHOLD = 3;
const MONTHS_TO_LOOK_BACK = 3;

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    // Get cutoff date
    const cutoffDate = subMonths(new Date(), MONTHS_TO_LOOK_BACK);

    // Get user's shifts
    const userShifts = await prisma.signup.findMany({
      where: {
        userId: user.id,
        status: "CONFIRMED",
        shift: {
          start: {
            gte: cutoffDate,
          },
        },
      },
      select: {
        shiftId: true,
      },
    });

    const userShiftIds = userShifts.map((signup) => signup.shiftId);

    if (userShiftIds.length === 0) {
      return NextResponse.json({ recommendedFriends: [] });
    }

    // Get existing friend IDs to exclude
    const existingFriends = await prisma.friendship.findMany({
      where: {
        OR: [{ userId: user.id }, { friendId: user.id }],
        status: "ACCEPTED",
      },
      select: {
        userId: true,
        friendId: true,
      },
    });

    const friendIds = existingFriends.map((f) =>
      f.userId === user.id ? f.friendId : f.userId
    );

    // Get pending friend requests (sent or received) to exclude
    const pendingRequests = await prisma.friendRequest.findMany({
      where: {
        OR: [
          { fromUserId: user.id, status: "PENDING" },
          { toEmail: user.email, status: "PENDING" },
        ],
        expiresAt: { gt: new Date() },
      },
      include: {
        fromUser: {
          select: {
            id: true,
          },
        },
      },
    });

    const pendingUserIds = pendingRequests.map((req) =>
      req.fromUserId === user.id ? req.toEmail : req.fromUser.id
    );

    // Find other users who were on the same shifts
    const sharedSignups = await prisma.signup.findMany({
      where: {
        shiftId: { in: userShiftIds },
        userId: { not: user.id },
        status: "CONFIRMED",
        user: {
          // Only include users who allow friend suggestions
          allowFriendSuggestions: true,
          // Exclude existing friends
          id: { notIn: friendIds },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePhotoUrl: true,
          },
        },
        shift: {
          select: {
            id: true,
            start: true,
            shiftType: {
              select: {
                name: true,
              },
            },
            location: true,
          },
        },
      },
    });

    // Count shared shifts per user
    const userShiftCounts = new Map<
      string,
      {
        user: (typeof sharedSignups)[0]["user"];
        shifts: (typeof sharedSignups)[0]["shift"][];
      }
    >();

    sharedSignups.forEach((signup) => {
      const userId = signup.user.id;

      // Skip if user has pending request
      if (
        pendingUserIds.includes(userId) ||
        pendingUserIds.includes(signup.user.email)
      ) {
        return;
      }

      if (!userShiftCounts.has(userId)) {
        userShiftCounts.set(userId, {
          user: signup.user,
          shifts: [],
        });
      }

      userShiftCounts.get(userId)!.shifts.push(signup.shift);
    });

    // Filter users with at least SHARED_SHIFTS_THRESHOLD shared shifts
    const recommendedFriends = Array.from(userShiftCounts.entries())
      .filter(([, data]) => data.shifts.length >= SHARED_SHIFTS_THRESHOLD)
      .map(([, data]) => ({
        id: data.user.id,
        name: data.user.name,
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        // Don't expose email address on client for privacy
        profilePhotoUrl: data.user.profilePhotoUrl,
        sharedShiftsCount: data.shifts.length,
        recentSharedShifts: data.shifts
          .sort((a, b) => b.start.getTime() - a.start.getTime())
          .slice(0, 3) // Most recent 3 shared shifts
          .map((shift) => ({
            id: shift.id,
            start: shift.start,
            shiftTypeName: shift.shiftType.name,
            location: shift.location,
          })),
      }))
      .sort((a, b) => b.sharedShiftsCount - a.sharedShiftsCount); // Sort by most shared shifts

    return NextResponse.json({ recommendedFriends });
  } catch (error) {
    console.error("Error fetching recommended friends:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
