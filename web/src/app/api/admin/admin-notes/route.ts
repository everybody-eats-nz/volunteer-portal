import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

// GET /api/admin/admin-notes?volunteerId=123 - Get notes for a specific volunteer
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const volunteerId = searchParams.get('volunteerId');

    if (!volunteerId) {
      return NextResponse.json({ error: "Volunteer ID required" }, { status: 400 });
    }

    const notes = await prisma.adminNote.findMany({
      where: {
        volunteerId,
        isArchived: false,
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
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(notes);
  } catch (error) {
    console.error("Error fetching admin notes:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin notes" },
      { status: 500 }
    );
  }
}

// POST /api/admin/admin-notes - Create a new note
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { volunteerId, content } = await request.json();

    if (!volunteerId || !content?.trim()) {
      return NextResponse.json(
        { error: "Volunteer ID and content are required" },
        { status: 400 }
      );
    }

    // Get the full user record for the session user
    const adminUser = await prisma.user.findUnique({
      where: { email: session.user.email! },
      select: { id: true },
    });

    if (!adminUser) {
      return NextResponse.json({ error: "Admin user not found" }, { status: 404 });
    }

    // Verify volunteer exists
    const volunteer = await prisma.user.findUnique({
      where: { id: volunteerId },
      select: { id: true },
    });

    if (!volunteer) {
      return NextResponse.json({ error: "Volunteer not found" }, { status: 404 });
    }

    const note = await prisma.adminNote.create({
      data: {
        volunteerId,
        content: content.trim(),
        createdBy: adminUser.id,
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

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error("Error creating admin note:", error);
    return NextResponse.json(
      { error: "Failed to create admin note" },
      { status: 500 }
    );
  }
}