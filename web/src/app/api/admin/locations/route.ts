import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

// Koha target per night — "" / null / undefined clear it; otherwise parse to 2dp.
function parseTarget(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

// GET - Fetch all locations
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const locations = await prisma.location.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });

    // Serialize Decimal targetPerNight to a plain number for JSON
    return NextResponse.json(
      locations.map((loc) => ({
        ...loc,
        targetPerNight:
          loc.targetPerNight === null ? null : Number(loc.targetPerNight),
      }))
    );
  } catch (error) {
    console.error("Error fetching locations:", error);
    return NextResponse.json(
      { error: "Failed to fetch locations" },
      { status: 500 }
    );
  }
}

// POST - Create a new location
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, address, defaultMealsServed, isPopup, targetPerNight } = body;

    if (!name || !address || defaultMealsServed === undefined) {
      return NextResponse.json(
        { error: "Name, address, and defaultMealsServed are required" },
        { status: 400 }
      );
    }

    const location = await prisma.location.create({
      data: {
        name,
        address,
        defaultMealsServed: parseInt(defaultMealsServed),
        targetPerNight: parseTarget(targetPerNight),
        isActive: true,
        isPopup: Boolean(isPopup),
      },
    });

    return NextResponse.json(location);
  } catch (error) {
    console.error("Error creating location:", error);
    return NextResponse.json(
      { error: "Failed to create location" },
      { status: 500 }
    );
  }
}

// PATCH - Update a location's settings
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, name, address, defaultMealsServed, isPopup, targetPerNight } =
      body;

    if (!id) {
      return NextResponse.json(
        { error: "Location ID is required" },
        { status: 400 }
      );
    }

    const updateData: Record<string, string | number | boolean | null> = {};
    if (name !== undefined) updateData.name = name;
    if (address !== undefined) updateData.address = address;
    if (defaultMealsServed !== undefined)
      updateData.defaultMealsServed = parseInt(defaultMealsServed);
    if (isPopup !== undefined) updateData.isPopup = Boolean(isPopup);
    if (targetPerNight !== undefined)
      updateData.targetPerNight = parseTarget(targetPerNight);

    const location = await prisma.location.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(location);
  } catch (error) {
    console.error("Error updating location:", error);
    return NextResponse.json(
      { error: "Failed to update location" },
      { status: 500 }
    );
  }
}
