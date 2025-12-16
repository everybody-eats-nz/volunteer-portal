import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

// DELETE - Soft delete location (set isActive to false)
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

    // Check if location exists
    const existingLocation = await prisma.location.findUnique({
      where: { id },
    });

    if (!existingLocation) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      );
    }

    if (!existingLocation.isActive) {
      return NextResponse.json(
        { error: "Location already disabled" },
        { status: 400 }
      );
    }

    // Count upcoming shifts at this location
    const upcomingShifts = await prisma.shift.count({
      where: {
        location: existingLocation.name,
        start: { gte: new Date() },
      },
    });

    // Soft delete by setting isActive to false
    await prisma.location.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({
      message: "Location disabled successfully",
      upcomingShifts,
    });
  } catch (error) {
    console.error("Failed to disable location:", error);
    return NextResponse.json(
      { error: "Failed to disable location" },
      { status: 500 }
    );
  }
}

// PUT - Re-enable location (set isActive to true)
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

    // Check if location exists
    const existingLocation = await prisma.location.findUnique({
      where: { id },
    });

    if (!existingLocation) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      );
    }

    // Re-enable by setting isActive to true
    const updatedLocation = await prisma.location.update({
      where: { id },
      data: { isActive: true },
    });

    return NextResponse.json(updatedLocation);
  } catch (error) {
    console.error("Failed to re-enable location:", error);
    return NextResponse.json(
      { error: "Failed to re-enable location" },
      { status: 500 }
    );
  }
}
