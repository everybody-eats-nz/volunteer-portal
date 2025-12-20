import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { z } from "zod";
import { AchievementCategory } from "@/generated/client";
import { VALID_CRITERIA_TYPES } from "@/lib/achievement-utils";

// Validation schema for achievement update
const achievementUpdateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  description: z
    .string()
    .min(1, "Description is required")
    .max(500, "Description too long"),
  category: z.enum([
    "MILESTONE",
    "DEDICATION",
    "SPECIALIZATION",
    "COMMUNITY",
    "IMPACT",
  ]),
  icon: z.string().min(1, "Icon is required").max(10, "Icon too long"),
  criteria: z.string().min(1, "Criteria is required"),
  points: z.number().int().min(0, "Points must be non-negative"),
  isActive: z.boolean().optional(),
});

// GET /api/admin/achievements/[id] - Get single achievement
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
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    if (!achievement) {
      return NextResponse.json(
        { error: "Achievement not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(achievement);
  } catch (error) {
    console.error("Error fetching achievement:", error);

    return NextResponse.json(
      { error: "Failed to fetch achievement" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/achievements/[id] - Update achievement
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();

    const parsed = achievementUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { name, description, category, icon, criteria, points, isActive } =
      parsed.data;

    // Validate that criteria is valid JSON
    try {
      const criteriaObj = JSON.parse(criteria);
      if (!criteriaObj.type || !criteriaObj.value) {
        return NextResponse.json(
          {
            error:
              "Invalid criteria format. Must include 'type' and 'value' fields",
          },
          { status: 400 }
        );
      }

      // Validate criteria type
      if (!VALID_CRITERIA_TYPES.includes(criteriaObj.type)) {
        return NextResponse.json(
          {
            error: `Invalid criteria type. Must be one of: ${VALID_CRITERIA_TYPES.join(
              ", "
            )}`,
          },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Criteria must be valid JSON" },
        { status: 400 }
      );
    }

    const resolvedParams = await params;

    // Check if achievement exists
    const existingAchievement = await prisma.achievement.findUnique({
      where: { id: resolvedParams.id },
    });

    if (!existingAchievement) {
      return NextResponse.json(
        { error: "Achievement not found" },
        { status: 404 }
      );
    }

    // Check if another achievement with this name exists (excluding current achievement)
    const duplicateAchievement = await prisma.achievement.findFirst({
      where: {
        name,
        NOT: { id: resolvedParams.id },
      },
    });

    if (duplicateAchievement) {
      return NextResponse.json(
        { error: "An achievement with this name already exists" },
        { status: 409 }
      );
    }

    const achievement = await prisma.achievement.update({
      where: { id: resolvedParams.id },
      data: {
        name,
        description,
        category: category as AchievementCategory,
        icon,
        criteria,
        points,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json(achievement);
  } catch (error) {
    console.error("Error updating achievement:", error);

    return NextResponse.json(
      { error: "Failed to update achievement" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/achievements/[id] - Delete achievement (soft delete)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const resolvedParams = await params;

    // Check if achievement exists
    const existingAchievement = await prisma.achievement.findUnique({
      where: { id: resolvedParams.id },
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    if (!existingAchievement) {
      return NextResponse.json(
        { error: "Achievement not found" },
        { status: 404 }
      );
    }

    // Check if users have unlocked this achievement
    const unlockedCount = existingAchievement._count.users;

    if (unlockedCount > 0) {
      // Soft delete - set isActive to false instead of actually deleting
      await prisma.achievement.update({
        where: { id: resolvedParams.id },
        data: {
          isActive: false,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Achievement deactivated. ${unlockedCount} user(s) have unlocked this achievement, so it was deactivated instead of deleted.`,
        unlockedCount,
      });
    } else {
      // No users have this achievement, safe to actually delete
      await prisma.achievement.delete({
        where: { id: resolvedParams.id },
      });

      return NextResponse.json({
        success: true,
        message: "Achievement deleted successfully",
        deleted: true,
      });
    }
  } catch (error) {
    console.error("Error deleting achievement:", error);

    return NextResponse.json(
      { error: "Failed to delete achievement" },
      { status: 500 }
    );
  }
}
