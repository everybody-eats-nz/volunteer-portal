import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

// GET /api/admin/restaurant-managers/[id] - Get specific restaurant manager
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const url = new URL(req.url);
  const segments = url.pathname.split("/");
  const id = segments[segments.length - 1];

  try {
    const manager = await prisma.restaurantManager.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            name: true,
            role: true,
          },
        },
      },
    });

    if (!manager) {
      return NextResponse.json(
        { error: "Restaurant manager not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(manager);
  } catch (error) {
    console.error("Error fetching restaurant manager:", error);
    return NextResponse.json(
      { error: "Failed to fetch restaurant manager" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/restaurant-managers/[id] - Update restaurant manager
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const url = new URL(req.url);
  const segments = url.pathname.split("/");
  const id = segments[segments.length - 1];

  try {
    const { locations, receiveNotifications } = await req.json();

    if (!Array.isArray(locations)) {
      return NextResponse.json(
        { error: "locations array is required" },
        { status: 400 }
      );
    }

    // Filter out empty locations and duplicates
    const validLocations = [
      ...new Set(locations.filter((loc: string) => loc.trim())),
    ];

    const manager = await prisma.restaurantManager.update({
      where: { id },
      data: {
        locations: validLocations,
        receiveNotifications: receiveNotifications ?? true,
        updatedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            name: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json(manager);
  } catch (error) {
    console.error("Error updating restaurant manager:", error);
    return NextResponse.json(
      { error: "Failed to update restaurant manager" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/restaurant-managers/[id] - Remove restaurant manager assignment
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const url = new URL(req.url);
  const segments = url.pathname.split("/");
  const id = segments[segments.length - 1];

  try {
    await prisma.restaurantManager.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting restaurant manager:", error);
    return NextResponse.json(
      { error: "Failed to delete restaurant manager" },
      { status: 500 }
    );
  }
}
