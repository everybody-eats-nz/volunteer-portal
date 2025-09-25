import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

// Get all custom labels
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const labels = await prisma.customLabel.findMany({
      where: {
        isActive: true,
      },
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
      orderBy: [
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json(labels);
  } catch (error) {
    console.error("Error fetching custom labels:", error);
    return NextResponse.json(
      { error: "Failed to fetch custom labels" },
      { status: 500 }
    );
  }
}

// Create new custom label
export async function POST(request: Request) {
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

    // Check if label with this name already exists
    const existingLabel = await prisma.customLabel.findUnique({
      where: { name }
    });

    if (existingLabel) {
      return NextResponse.json(
        { error: "A label with this name already exists" },
        { status: 409 }
      );
    }

    const label = await prisma.customLabel.create({
      data: {
        name,
        color,
        icon: icon || null,
      },
    });

    return NextResponse.json(label);
  } catch (error) {
    console.error("Error creating custom label:", error);
    
    return NextResponse.json(
      { error: "Failed to create custom label" },
      { status: 500 }
    );
  }
}