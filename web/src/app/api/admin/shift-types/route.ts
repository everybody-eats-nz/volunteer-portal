import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { z } from "zod";

// GET /api/admin/shift-types - List all shift types for admin forms
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    );
  }

  try {
    const shiftTypes = await prisma.shiftType.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(shiftTypes);
  } catch (error) {
    console.error("Error fetching shift types:", error);
    return NextResponse.json(
      { error: "Failed to fetch shift types" },
      { status: 500 }
    );
  }
}

// POST /api/admin/shift-types - Create a new shift type
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    
    const shiftTypeSchema = z.object({
      name: z.string().min(1, "Name is required").max(100, "Name too long"),
      description: z.string().optional().nullable(),
    });

    const parsed = shiftTypeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { name, description } = parsed.data;

    // Check if shift type with this name already exists
    const existing = await prisma.shiftType.findUnique({
      where: { name },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A shift type with this name already exists" },
        { status: 409 }
      );
    }

    const shiftType = await prisma.shiftType.create({
      data: {
        name,
        description,
      },
    });

    return NextResponse.json(shiftType, { status: 201 });
  } catch (error) {
    console.error("Error creating shift type:", error);
    return NextResponse.json(
      { error: "Failed to create shift type" },
      { status: 500 }
    );
  }
}