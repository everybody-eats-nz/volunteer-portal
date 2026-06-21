import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/client";

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

    if (
      name !== undefined &&
      (typeof name !== "string" || name.trim() === "")
    ) {
      return NextResponse.json(
        { error: "Location name must be a non-empty string" },
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

    // The location name is stored as a free-text string (no FK) across many
    // tables, so a rename must cascade to keep them in sync — otherwise old
    // records keep the previous name and surface as a duplicate location.
    const existing = await prisma.location.findUnique({
      where: { id },
      select: { name: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      );
    }

    const oldName = existing.name;
    const newName = typeof name === "string" ? name : undefined;
    const isRename = newName !== undefined && newName !== oldName;

    const location = await prisma.$transaction(async (tx) => {
      const updated = await tx.location.update({
        where: { id },
        data: updateData,
      });

      if (isRename) {
        // Only rows explicitly referencing the old name are touched; rows with
        // a null location (templates/rules that apply to all locations) are
        // intentionally left untouched.
        const where = { location: oldName };
        const data = { location: newName };
        await Promise.all([
          tx.shift.updateMany({ where, data }),
          tx.shiftTemplate.updateMany({ where, data }),
          tx.regularVolunteer.updateMany({ where, data }),
          tx.autoAcceptRule.updateMany({ where, data }),
          tx.mealsServed.updateMany({ where, data }),
          tx.dailyMenu.updateMany({ where, data }),
          tx.messagingHours.updateMany({ where, data }),
          tx.user.updateMany({
            where: { defaultLocation: oldName },
            data: { defaultLocation: newName },
          }),
          // RestaurantManager.locations is a string[] — replace in place.
          tx.$executeRaw`
            UPDATE "RestaurantManager"
            SET "locations" = array_replace("locations", ${oldName}, ${newName})
            WHERE ${oldName} = ANY("locations")
          `,
        ]);
      }

      return updated;
    });

    return NextResponse.json(location);
  } catch (error) {
    console.error("Error updating location:", error);
    // A rename can collide with a unique constraint on one of the cascaded
    // tables (e.g. MealsServed/DailyMenu [date, location]); surface that
    // clearly instead of a generic 500.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          error:
            "Cannot rename location: a conflicting record already exists under the new name",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update location" },
      { status: 500 }
    );
  }
}
