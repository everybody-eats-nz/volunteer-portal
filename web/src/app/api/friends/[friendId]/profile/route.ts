import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ friendId: string }> }
) {
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
    const { friendId } = await params;

    // Verify friendship exists
    const friendship = await prisma.friendship.findFirst({
      where: {
        AND: [
          {
            OR: [
              { userId: user.id, friendId },
              { userId: friendId, friendId: user.id },
            ],
          },
          { status: "ACCEPTED" },
        ],
      },
    });

    if (!friendship) {
      return NextResponse.json(
        { error: "Friendship not found" },
        { status: 404 }
      );
    }

    // Get friend's profile and privacy settings
    const friend = await prisma.user.findUnique({
      where: { id: friendId },
      select: {
        id: true,
        friendVisibility: true,
      },
    });

    if (!friend) {
      return NextResponse.json(
        { error: "Friend not found" },
        { status: 404 }
      );
    }

    // Check if user can view friend's activity
    const canViewActivity = 
      friend.friendVisibility === "PUBLIC" || 
      friend.friendVisibility === "FRIENDS_ONLY";

    if (!canViewActivity) {
      return NextResponse.json({
        shifts: [],
        achievements: [],
        totalShifts: 0,
        totalHours: 0,
        message: "This user's profile is private",
      });
    }

    // Get friend's upcoming shifts
    const upcomingShifts = await prisma.signup.findMany({
      where: {
        userId: friendId,
        status: { in: ["CONFIRMED", "PENDING"] },
        shift: {
          start: { gte: new Date() },
        },
      },
      include: {
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
        shift: {
          start: "asc",
        },
      },
      take: 10, // Limit to next 10 shifts
    });

    // Get friend's achievements
    const achievements = await prisma.userAchievement.findMany({
      where: {
        userId: friendId,
      },
      include: {
        achievement: {
          select: {
            name: true,
            description: true,
            icon: true,
            category: true,
            points: true,
          },
        },
      },
      orderBy: {
        unlockedAt: "desc",
      },
      take: 20, // Limit to most recent 20 achievements
    });

    // Calculate total shifts completed
    const totalShifts = await prisma.signup.count({
      where: {
        userId: friendId,
        status: "CONFIRMED",
        shift: {
          end: { lt: new Date() },
        },
      },
    });

    // Calculate total hours (estimate based on average shift length)
    const completedShifts = await prisma.signup.findMany({
      where: {
        userId: friendId,
        status: "CONFIRMED",
        shift: {
          end: { lt: new Date() },
        },
      },
      include: {
        shift: {
          select: {
            start: true,
            end: true,
          },
        },
      },
    });

    const totalHours = completedShifts.reduce((total, signup) => {
      const duration = new Date(signup.shift.end).getTime() - new Date(signup.shift.start).getTime();
      const hours = duration / (1000 * 60 * 60);
      return total + hours;
    }, 0);

    // Format the response
    const formattedShifts = upcomingShifts.map((signup) => ({
      id: signup.shift.id,
      start: signup.shift.start,
      end: signup.shift.end,
      location: signup.shift.location,
      shiftType: signup.shift.shiftType,
      status: signup.status,
    }));

    return NextResponse.json({
      shifts: formattedShifts,
      achievements,
      totalShifts,
      totalHours: Math.round(totalHours),
    });
  } catch (error) {
    console.error("Error fetching friend profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}