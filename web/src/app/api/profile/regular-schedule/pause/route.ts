import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Validation schema for pausing/resuming
const pauseScheduleSchema = z.object({
  isPaused: z.boolean(),
  pausedUntil: z.string().nullable().optional(),
  reason: z.string().optional(),
});

// PATCH /api/profile/regular-schedule/pause - Pause/resume regular schedule
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validated = pauseScheduleSchema.parse(body);

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

    // Update pause status
    const updateData: Record<string, unknown> = {
      isPausedByUser: validated.isPaused,
      lastModifiedBy: session.user?.id,
      updatedAt: new Date(),
    };

    if (validated.isPaused && validated.pausedUntil) {
      updateData.pausedUntil = new Date(validated.pausedUntil);
    } else if (!validated.isPaused) {
      updateData.pausedUntil = null;
    }

    if (validated.reason) {
      updateData.volunteerNotes = `Pause reason: ${validated.reason}. ${
        existing.volunteerNotes || ""
      }`;
    }

    const updated = await prisma.regularVolunteer.update({
      where: { userId: session.user?.id },
      data: updateData,
      include: {
        shiftType: true,
      },
    });

    // If pausing, cancel any pending regular signups
    if (validated.isPaused) {
      const pendingSignups = await prisma.regularSignup.findMany({
        where: {
          regularVolunteerId: existing.id,
          signup: {
            status: "REGULAR_PENDING",
          },
        },
        include: {
          signup: true,
        },
      });

      if (pendingSignups.length > 0) {
        const signupIds = pendingSignups.map((rs) => rs.signup.id);
        await prisma.signup.updateMany({
          where: {
            id: { in: signupIds },
          },
          data: {
            status: "CANCELED",
            canceledAt: new Date(),
            cancellationReason:
              validated.reason || "Regular schedule paused by volunteer",
          },
        });
      }
    }

    return NextResponse.json({
      message: `Regular schedule ${
        validated.isPaused ? "paused" : "resumed"
      } successfully`,
      regular: updated,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error pausing/resuming regular schedule:", error);
    return NextResponse.json(
      { error: "Failed to update pause status" },
      { status: 500 }
    );
  }
}
