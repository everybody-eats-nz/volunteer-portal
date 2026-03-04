import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

// GET /api/admin/achievements/[id]/users - Get users who unlocked this achievement
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const resolvedParams = await params;

    const achievement = await prisma.achievement.findUnique({
      where: { id: resolvedParams.id },
      select: { id: true, name: true },
    });

    if (!achievement) {
      return NextResponse.json(
        { error: "Achievement not found" },
        { status: 404 }
      );
    }

    const userAchievements = await prisma.userAchievement.findMany({
      where: { achievementId: resolvedParams.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profilePhotoUrl: true,
          },
        },
      },
      orderBy: { unlockedAt: "desc" },
    });

    return NextResponse.json(
      userAchievements.map((ua) => ({
        userId: ua.user.id,
        name: ua.user.name,
        email: ua.user.email,
        image: ua.user.profilePhotoUrl,
        unlockedAt: ua.unlockedAt,
      }))
    );
  } catch (error) {
    console.error("Error fetching achievement users:", error);

    return NextResponse.json(
      { error: "Failed to fetch achievement users" },
      { status: 500 }
    );
  }
}
