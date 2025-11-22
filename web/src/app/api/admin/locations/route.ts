import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

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

    return NextResponse.json(locations);
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
    const { name, address, defaultMealsServed } = body;

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
        isActive: true,
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
    const { id, name, address, defaultMealsServed } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Location ID is required" },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (address !== undefined) updateData.address = address;
    if (defaultMealsServed !== undefined) updateData.defaultMealsServed = parseInt(defaultMealsServed);

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
