import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

// Update custom label
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { name, color, icon } = await request.json();

    if (!name || !color) {
      return NextResponse.json(
        { error: "Name and color are required" },
        { status: 400 }
      );
    }

    const resolvedParams = await params;

    // Check if label exists
    const existingLabel = await prisma.customLabel.findUnique({
      where: { id: resolvedParams.id }
    });

    if (!existingLabel) {
      return NextResponse.json(
        { error: "Label not found" },
        { status: 404 }
      );
    }

    // Check if another label with this name exists (excluding current label)
    const duplicateLabel = await prisma.customLabel.findFirst({
      where: { 
        name,
        NOT: { id: resolvedParams.id }
      }
    });

    if (duplicateLabel) {
      return NextResponse.json(
        { error: "A label with this name already exists" },
        { status: 409 }
      );
    }

    const label = await prisma.customLabel.update({
      where: { id: resolvedParams.id },
      data: {
        name,
        color,
        icon: icon || null,
      },
    });

    return NextResponse.json(label);
  } catch (error) {
    console.error("Error updating custom label:", error);
    
    return NextResponse.json(
      { error: "Failed to update custom label" },
      { status: 500 }
    );
  }
}

// Delete custom label (soft delete)
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

    // Check if label exists
    const existingLabel = await prisma.customLabel.findUnique({
      where: { id: resolvedParams.id }
    });

    if (!existingLabel) {
      return NextResponse.json(
        { error: "Label not found" },
        { status: 404 }
      );
    }

    await prisma.customLabel.update({
      where: { id: resolvedParams.id },
      data: {
        isActive: false,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting custom label:", error);
    
    return NextResponse.json(
      { error: "Failed to delete custom label" },
      { status: 500 }
    );
  }
}