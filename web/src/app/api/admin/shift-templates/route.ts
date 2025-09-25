import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Schema for validating shift template data
const shiftTemplateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  shiftTypeId: z.string().cuid("Invalid shift type ID"),
  location: z.string().min(1, "Location is required").max(50, "Location too long"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format (HH:MM)"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format (HH:MM)"),
  capacity: z.number().int().min(1, "Capacity must be at least 1").max(100, "Capacity too high"),
  notes: z.string().optional(),
});

// GET - List all active templates
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const templates = await prisma.shiftTemplate.findMany({
      where: { isActive: true },
      include: { shiftType: true },
      orderBy: [{ location: "asc" }, { name: "asc" }],
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Failed to fetch shift templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

// POST - Create new template
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = shiftTemplateSchema.parse(body);

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

    // Check if template with same name and location already exists
    const existingTemplate = await prisma.shiftTemplate.findUnique({
      where: {
        name_location: {
          name: data.name,
          location: data.location,
        },
      },
    });

    if (existingTemplate) {
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

    const template = await prisma.shiftTemplate.create({
      data: {
        ...data,
        createdBy: session.user.id,
      },
      include: { shiftType: true },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Failed to create shift template:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}