import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Schema for validating shift template updates
const updateTemplateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  shiftTypeId: z.string().cuid("Invalid shift type ID"),
  location: z.string().min(1, "Location is required").max(50, "Location too long"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format (HH:MM)"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format (HH:MM)"),
  capacity: z.number().int().min(1, "Capacity must be at least 1").max(100, "Capacity too high"),
  notes: z.string().optional(),
});

// PUT - Update existing template
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const data = updateTemplateSchema.parse(body);

    // Validate that start time is before end time
    const [startHour, startMin] = data.startTime.split(":").map(Number);
    const [endHour, endMin] = data.endTime.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (startMinutes >= endMinutes) {
      return NextResponse.json(
        { error: "End time must be after start time" },
        { status: 400 }
      );
    }

    // Check if template exists
    const existingTemplate = await prisma.shiftTemplate.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // Check if another template with same name and location exists (excluding current one)
    const conflictingTemplate = await prisma.shiftTemplate.findFirst({
      where: {
        name: data.name,
        location: data.location,
        id: { not: id },
        isActive: true,
      },
    });

    if (conflictingTemplate) {
      return NextResponse.json(
        { error: "Template with this name already exists for this location" },
        { status: 409 }
      );
    }

    // Verify shift type exists
    const shiftType = await prisma.shiftType.findUnique({
      where: { id: data.shiftTypeId },
    });

    if (!shiftType) {
      return NextResponse.json(
        { error: "Invalid shift type" },
        { status: 400 }
      );
    }

    const updatedTemplate = await prisma.shiftTemplate.update({
      where: { id },
      data,
      include: { shiftType: true },
    });

    return NextResponse.json(updatedTemplate);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Failed to update shift template:", error);
    return NextResponse.json(
      { error: "Failed to update template" },
      { status: 500 }
    );
  }
}

// DELETE - Soft delete template (set isActive to false)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = await params;

    // Check if template exists
    const existingTemplate = await prisma.shiftTemplate.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    if (!existingTemplate.isActive) {
      return NextResponse.json(
        { error: "Template already deleted" },
        { status: 400 }
      );
    }

    // Soft delete by setting isActive to false
    const deletedTemplate = await prisma.shiftTemplate.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ message: "Template deleted successfully" });
  } catch (error) {
    console.error("Failed to delete shift template:", error);
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    );
  }
}