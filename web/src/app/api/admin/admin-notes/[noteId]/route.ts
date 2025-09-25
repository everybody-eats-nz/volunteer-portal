import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

interface RouteContext {
  params: Promise<{ noteId: string }>;
}

// PUT /api/admin/admin-notes/[noteId] - Update a note
export async function PUT(request: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { noteId } = await params;
    const { content } = await request.json();

    if (!content?.trim()) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    // Check if note exists and user has permission
    const existingNote = await prisma.adminNote.findUnique({
      where: { id: noteId },
      select: {
        id: true,
        createdBy: true,
        isArchived: true,
      },
    });

    if (!existingNote) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    if (existingNote.isArchived) {
      return NextResponse.json({ error: "Cannot edit archived note" }, { status: 400 });
    }

    // Only allow the creator or admin to edit (for now, all admins can edit)
    const updatedNote = await prisma.adminNote.update({
      where: { id: noteId },
      data: {
        content: content.trim(),
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return NextResponse.json(updatedNote);
  } catch (error) {
    console.error("Error updating admin note:", error);
    return NextResponse.json(
      { error: "Failed to update admin note" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/admin-notes/[noteId] - Archive a note (soft delete)
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { noteId } = await params;

    // Check if note exists
    const existingNote = await prisma.adminNote.findUnique({
      where: { id: noteId },
      select: {
        id: true,
        isArchived: true,
      },
    });

    if (!existingNote) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    if (existingNote.isArchived) {
      return NextResponse.json({ error: "Note already archived" }, { status: 400 });
    }

    // Soft delete by setting isArchived to true
    await prisma.adminNote.update({
      where: { id: noteId },
      data: { isArchived: true },
    });

    return NextResponse.json({ message: "Note archived successfully" });
  } catch (error) {
    console.error("Error archiving admin note:", error);
    return NextResponse.json(
      { error: "Failed to archive admin note" },
      { status: 500 }
    );
  }
}