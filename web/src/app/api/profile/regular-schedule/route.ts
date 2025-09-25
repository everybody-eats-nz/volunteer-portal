import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Validation schema for updating regular volunteer settings
const updateRegularScheduleSchema = z.object({
  availableDays: z
    .array(
      z.enum([
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ])
    )
    .optional(),
  frequency: z.enum(["WEEKLY", "FORTNIGHTLY", "MONTHLY"]).optional(),
  volunteerNotes: z.string().nullable().optional(),
});

// GET /api/profile/regular-schedule - Get current user's regular schedule
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const regular = await prisma.regularVolunteer.findUnique({
      where: { userId: session.user?.id },
      include: {
        shiftType: true,
        autoSignups: {
          take: 20,
          orderBy: {
            createdAt: "desc",
          },
          include: {
            signup: {
              include: {
                shift: true,
              },
            },
          },
        },
      },
    });

    if (!regular) {
      return NextResponse.json(null);
    }

    // Check if pause period has expired and auto-resume
    if (
      regular.isPausedByUser &&
      regular.pausedUntil &&
      regular.pausedUntil < new Date()
    ) {
      const updated = await prisma.regularVolunteer.update({
        where: { id: regular.id },
        data: {
          isPausedByUser: false,
          pausedUntil: null,
          lastModifiedBy: session.user?.id,
        },
        include: {
          shiftType: true,
          autoSignups: {
            take: 20,
            orderBy: {
              createdAt: "desc",
            },
            include: {
              signup: {
                include: {
                  shift: true,
                },
              },
            },
          },
        },
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json(regular);
  } catch (error) {
    console.error("Error fetching regular schedule:", error);
    return NextResponse.json(
      { error: "Failed to fetch regular schedule" },
      { status: 500 }
    );
  }
}

// PUT /api/profile/regular-schedule - Update own regular schedule configuration
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validated = updateRegularScheduleSchema.parse(body);

    // Check if user has a regular volunteer record
    const existing = await prisma.regularVolunteer.findUnique({
      where: { userId: session.user?.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "You are not registered as a regular volunteer" },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      lastModifiedBy: session.user?.id,
      updatedAt: new Date(),
    };

    // Volunteers can only modify certain fields
    if (validated.availableDays !== undefined) {
      updateData.availableDays = validated.availableDays;
    }
    if (validated.frequency !== undefined) {
      updateData.frequency = validated.frequency;
    }
    if (validated.volunteerNotes !== undefined) {
      updateData.volunteerNotes = validated.volunteerNotes;
    }

    // Update the regular volunteer record
    const updated = await prisma.regularVolunteer.update({
      where: { userId: session.user?.id },
      data: updateData,
      include: {
        shiftType: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error updating regular schedule:", error);
    return NextResponse.json(
      { error: "Failed to update regular schedule" },
      { status: 500 }
    );
  }
}
