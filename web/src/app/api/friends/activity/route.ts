import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

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
    // Get user's friends
    const friendships = await prisma.friendship.findMany({
      where: {
        AND: [
          {
            OR: [{ userId: user.id }, { friendId: user.id }],
          },
          { status: "ACCEPTED" },
        ],
      },
      select: {
        userId: true,
        friendId: true,
        user: {
          select: {
            id: true,
            friendVisibility: true,
          },
        },
        friend: {
          select: {
            id: true,
            friendVisibility: true,
          },
        },
      },
    });

    // Get friend IDs who allow visibility
    const visibleFriendIds = friendships
      .map((friendship) => {
        const friend = friendship.userId === user.id ? friendship.friend : friendship.user;
        const friendId = friendship.userId === user.id ? friendship.friendId : friendship.userId;
        
        // Check if friend allows visibility to friends
        return friend.friendVisibility === "PUBLIC" || friend.friendVisibility === "FRIENDS_ONLY"
          ? friendId
          : null;
      })
      .filter(Boolean) as string[];

    if (visibleFriendIds.length === 0) {
      return NextResponse.json({ activities: [] });
    }

    // Get recent friend activities (shift signups)
    const recentActivities = await prisma.signup.findMany({
      where: {
        userId: { in: visibleFriendIds },
        status: { in: ["CONFIRMED", "PENDING"] },
        shift: {
          start: { gte: new Date() }, // Only future shifts
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
        shift: {
          include: {
            shiftType: {
              select: {
                name: true,
                description: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50, // Limit to recent activities
    });

    // Format activities
    const formattedActivities = recentActivities.map((signup) => ({
      id: signup.id,
      type: "shift_signup",
      friend: {
        id: signup.user.id,
        name: signup.user.name,
        firstName: signup.user.firstName,
        lastName: signup.user.lastName,
        profilePhotoUrl: signup.user.profilePhotoUrl,
      },
      shift: {
        id: signup.shift.id,
        start: signup.shift.start,
        end: signup.shift.end,
        location: signup.shift.location,
        shiftType: signup.shift.shiftType,
      },
      status: signup.status,
      createdAt: signup.createdAt,
    }));

    return NextResponse.json({ activities: formattedActivities });
  } catch (error) {
    console.error("Error fetching friend activity:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}