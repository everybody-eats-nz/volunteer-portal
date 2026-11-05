import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  assignLabel,
  updateLabelNote,
  LabelAssignmentError,
} from "@/lib/custom-labels.server";

type AssignmentWithLabel = Awaited<ReturnType<typeof assignLabel>>;

/** The shape the labels manager keeps: the label plus who added it and why. */
function serializeAssignment(assignment: AssignmentWithLabel) {
  return {
    label: assignment.label,
    note: assignment.note,
    assignedAt: assignment.assignedAt,
    assignedBy: assignment.assignedBy,
  };
}

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

// Add label to user. Labels with `requiresNote` need a `note`.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { labelId, note } = await request.json();
    if (!labelId) {
      return NextResponse.json(
        { error: "Label ID is required" },
        { status: 400 }
      );
    }

    const { id } = await params;
    const assignment = await assignLabel({
      userId: id,
      labelId,
      note,
      assignedById: session.user.id,
    });

    return NextResponse.json(serializeAssignment(assignment));
  } catch (error) {
    if (error instanceof LabelAssignmentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error adding label to user:", error);
    return NextResponse.json(
      { error: "Failed to add label to user" },
      { status: 500 }
    );
  }
}

// Change the note on a label the user already has
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { labelId, note } = await request.json();
    if (!labelId) {
      return NextResponse.json(
        { error: "Label ID is required" },
        { status: 400 }
      );
    }

    const { id } = await params;
    const assignment = await updateLabelNote({ userId: id, labelId, note });
    return NextResponse.json(serializeAssignment(assignment));
  } catch (error) {
    if (error instanceof LabelAssignmentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error updating label note:", error);
    return NextResponse.json(
      { error: "Failed to update label note" },
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