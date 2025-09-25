import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

// GET /api/admin/restaurant-managers - List all restaurant managers
export async function GET() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const managers = await prisma.restaurantManager.findMany({
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
      orderBy: {
        user: {
          email: "asc",
        },
      },
    });

    return NextResponse.json(managers);
  } catch (error) {
    console.error("Error fetching restaurant managers:", error);
    return NextResponse.json(
      { error: "Failed to fetch restaurant managers" },
      { status: 500 }
    );
  }
}

// POST /api/admin/restaurant-managers - Create or update restaurant manager assignment
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { userId, locations, receiveNotifications = true } = await req.json();

    if (!userId || !Array.isArray(locations)) {
      return NextResponse.json(
        { error: "userId and locations array are required" },
        { status: 400 }
      );
    }

    // Verify user exists and is an admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "User must be an admin to be assigned as restaurant manager" },
        { status: 400 }
      );
    }

    // Filter out empty locations and duplicates
    const validLocations = [
      ...new Set(locations.filter((loc: string) => loc.trim())),
    ];

    // Upsert restaurant manager record
    const manager = await prisma.restaurantManager.upsert({
      where: { userId },
      update: {
        locations: validLocations,
        receiveNotifications,
        updatedAt: new Date(),
      },
      create: {
        userId,
        locations: validLocations,
        receiveNotifications,
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
    console.error("Error creating/updating restaurant manager:", error);
    return NextResponse.json(
      { error: "Failed to create/update restaurant manager" },
      { status: 500 }
    );
  }
}
