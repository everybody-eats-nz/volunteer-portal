import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { LocationSchema } from "@/lib/validation-schemas";

// Validation schema for updating a regular volunteer
const updateRegularVolunteerSchema = z.object({
  shiftTypeId: z.string().optional(),
  location: LocationSchema.optional(),
  frequency: z.enum(["WEEKLY", "FORTNIGHTLY", "MONTHLY"]).optional(),
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
  notes: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/admin/regulars/[id] - Get a specific regular volunteer
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    if (!session?.user || role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const regular = await prisma.regularVolunteer.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        shiftType: true,
        autoSignups: {
          take: 10,
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
      return NextResponse.json(
        { error: "Regular volunteer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(regular);
  } catch (error) {
    console.error("Error fetching regular volunteer:", error);
    return NextResponse.json(
      { error: "Failed to fetch regular volunteer" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/regulars/[id] - Update a regular volunteer
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    if (!session?.user || role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const validated = updateRegularVolunteerSchema.parse(body);

    // Check if regular volunteer exists
    const existing = await prisma.regularVolunteer.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Regular volunteer not found" },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      lastModifiedBy: session?.user?.id,
      updatedAt: new Date(),
    };

    if (validated.shiftTypeId !== undefined) {
      updateData.shiftTypeId = validated.shiftTypeId;
    }
    if (validated.location !== undefined) {
      updateData.location = validated.location;
    }
    if (validated.frequency !== undefined) {
      updateData.frequency = validated.frequency;
    }
    if (validated.availableDays !== undefined) {
      updateData.availableDays = validated.availableDays;
    }
    if (validated.notes !== undefined) {
      updateData.notes = validated.notes;
    }
    if (validated.isActive !== undefined) {
      updateData.isActive = validated.isActive;
    }

    // Update the regular volunteer
    const updated = await prisma.regularVolunteer.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
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

    console.error("Error updating regular volunteer:", error);
    return NextResponse.json(
      { error: "Failed to update regular volunteer" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/regulars/[id] - Remove regular volunteer status
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    if (!session?.user || role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    // Check if regular volunteer exists
    const existing = await prisma.regularVolunteer.findUnique({
      where: { id },
      include: {
        autoSignups: {
          where: {
            signup: {
              status: "REGULAR_PENDING",
            },
          },
          include: {
            signup: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Regular volunteer not found" },
        { status: 404 }
      );
    }

    // Cancel any pending regular signups
    const pendingSignupIds = existing.autoSignups
      .filter((rs) => rs.signup && rs.signup.status === "REGULAR_PENDING")
      .map((rs) => rs.signup.id);

    if (pendingSignupIds.length > 0) {
      await prisma.signup.updateMany({
        where: {
          id: { in: pendingSignupIds },
        },
        data: {
          status: "CANCELED",
          canceledAt: new Date(),
          cancellationReason: "Regular volunteer status removed",
        },
      });
    }

    // Delete the regular volunteer record
    await prisma.regularVolunteer.delete({
      where: { id },
    });

    return NextResponse.json({
      message: "Regular volunteer status removed successfully",
    });
  } catch (error) {
    console.error("Error deleting regular volunteer:", error);
    return NextResponse.json(
      { error: "Failed to remove regular volunteer status" },
      { status: 500 }
    );
  }
}
