import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { z } from "zod";
import { AchievementCategory } from "@/generated/client";

// Validation schema for achievement
const achievementSchema = z.object({
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

// GET /api/admin/achievements - List all achievements
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    );
  }

  try {
    const achievements = await prisma.achievement.findMany({
      include: {
        _count: {
          select: {
            users: true, // Count how many users have unlocked each achievement
          },
        },
      },
      orderBy: [{ category: "asc" }, { points: "asc" }],
    });

    return NextResponse.json(achievements);
  } catch (error) {
    console.error("Error fetching achievements:", error);
    return NextResponse.json(
      { error: "Failed to fetch achievements" },
      { status: 500 }
    );
  }
}

// POST /api/admin/achievements - Create a new achievement
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();

    const parsed = achievementSchema.safeParse(body);
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
      const validTypes = [
        "shifts_completed",
        "hours_volunteered",
        "consecutive_months",
        "specific_shift_type",
        "years_volunteering",
        "community_impact",
        "friends_count",
      ];
      if (!validTypes.includes(criteriaObj.type)) {
        return NextResponse.json(
          {
            error: `Invalid criteria type. Must be one of: ${validTypes.join(
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

    // Check if achievement with this name already exists
    const existing = await prisma.achievement.findUnique({
      where: { name },
    });

    if (existing) {
      return NextResponse.json(
        { error: "An achievement with this name already exists" },
        { status: 409 }
      );
    }

    const achievement = await prisma.achievement.create({
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

    return NextResponse.json(achievement, { status: 201 });
  } catch (error) {
    console.error("Error creating achievement:", error);
    return NextResponse.json(
      { error: "Failed to create achievement" },
      { status: 500 }
    );
  }
}
