import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

// Get user's custom labels
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
    const userLabels = await prisma.userCustomLabel.findMany({
      where: {
        userId: resolvedParams.id,
      },
      include: {
        label: true,
      },
      orderBy: {
        assignedAt: "desc",
      },
    });

    return NextResponse.json(userLabels.map(ul => ul.label));
  } catch (error) {
    console.error("Error fetching user labels:", error);
    return NextResponse.json(
      { error: "Failed to fetch user labels" },
      { status: 500 }
    );
  }
}

// Add label to user
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { labelId } = await request.json();

    if (!labelId) {
      return NextResponse.json(
        { error: "Label ID is required" },
        { status: 400 }
      );
    }

    const resolvedParams = await params;
    
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: resolvedParams.id },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Check if label exists and is active
    const label = await prisma.customLabel.findUnique({
      where: { id: labelId, isActive: true },
    });

    if (!label) {
      return NextResponse.json(
        { error: "Label not found or inactive" },
        { status: 404 }
      );
    }

    const userLabel = await prisma.userCustomLabel.create({
      data: {
        userId: resolvedParams.id,
        labelId,
      },
      include: {
        label: true,
      },
    });

    return NextResponse.json(userLabel.label);
  } catch (error) {
    console.error("Error adding label to user:", error);
    
    // Check if it's a unique constraint violation
    // This shouldn't happen since we check existence above
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message.includes('unique')) {
      return NextResponse.json(
        { error: "User already has this label" },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to add label to user" },
      { status: 500 }
    );
  }
}

// Remove label from user
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { labelId } = await request.json();

    if (!labelId) {
      return NextResponse.json(
        { error: "Label ID is required" },
        { status: 400 }
      );
    }

    const resolvedParams = await params;
    
    await prisma.userCustomLabel.delete({
      where: {
        userId_labelId: {
          userId: resolvedParams.id,
          labelId,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing label from user:", error);
    
    // Check if it's a record not found error
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message.includes('not found')) {
      return NextResponse.json(
        { error: "User label assignment not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to remove label from user" },
      { status: 500 }
    );
  }
}