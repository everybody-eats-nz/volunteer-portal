import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Test-only endpoint for seeding achievements
 * Only available in development/test environments
 *
 * Achievements unlock lazily for every volunteer who loads their dashboard,
 * so an active test achievement leaks onto real seeded volunteers. Seeded
 * achievements are therefore inactive by default and awarded directly to the
 * users a test names.
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const {
      name,
      description = "E2E test achievement",
      category = "MILESTONE",
      icon = "🌟",
      criteria = { type: "shifts_completed", value: 1 },
      points = 10,
      isActive = false,
      unlockedFor = [],
    } = body;

    if (!name) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }

    const achievement = await prisma.achievement.create({
      data: {
        name,
        description,
        category,
        icon,
        criteria: JSON.stringify(criteria),
        points,
        isActive,
        users: {
          create: (unlockedFor as string[]).map((userId) => ({ userId })),
        },
      },
    });

    return NextResponse.json({ id: achievement.id });
  } catch (error) {
    console.error("Error creating test achievement:", error);
    return NextResponse.json(
      { error: "Failed to create achievement" },
      { status: 500 }
    );
  }
}

/**
 * Hard-deletes an achievement and every unlock of it. The admin DELETE route
 * only deactivates an achievement once anyone has unlocked it.
 */
export async function DELETE(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  try {
    const id = new URL(request.url).searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.userAchievement.deleteMany({ where: { achievementId: id } }),
      prisma.achievement.deleteMany({ where: { id } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting test achievement:", error);
    return NextResponse.json(
      { error: "Failed to delete achievement" },
      { status: 500 }
    );
  }
}
