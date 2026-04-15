import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

function requireAdmin() {
  return getServerSession(authOptions).then((session) => {
    if (!session || session.user.role !== "ADMIN") {
      return null;
    }
    return session;
  });
}

/**
 * GET /api/admin/menus
 *
 * With ?date=YYYY-MM-DD&location=X  → returns specific menu or null
 * Otherwise                          → returns recent 30 menus (all locations)
 */
export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const dateParam = searchParams.get("date");
  const location = searchParams.get("location");

  if (dateParam && location) {
    const date = new Date(`${dateParam}T00:00:00.000Z`);
    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }

    const menu = await prisma.dailyMenu.findUnique({
      where: { date_location: { date, location } },
    });

    return NextResponse.json(menu ?? null);
  }

  // List mode
  const menus = await prisma.dailyMenu.findMany({
    orderBy: [{ date: "desc" }, { location: "asc" }],
    take: 30,
    select: {
      id: true,
      date: true,
      location: true,
      chefName: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(menus);
}

/**
 * POST /api/admin/menus
 *
 * Creates or replaces the menu for a given date + location.
 * Body: { date, location, chefName?, announcement?, starter, mains, drink, dessert }
 */
export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  let body: {
    date: string;
    location: string;
    chefName?: string;
    announcement?: string;
    starter: { name: string; description?: string }[];
    mains: { name: string; description?: string }[];
    drink: { name: string; description?: string }[];
    dessert: { name: string; description?: string }[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { date: dateParam, location, chefName, announcement, starter, mains, drink, dessert } = body;

  if (!dateParam || !location) {
    return NextResponse.json(
      { error: "date and location are required" },
      { status: 400 }
    );
  }

  if (!Array.isArray(starter) || !Array.isArray(mains) || !Array.isArray(drink) || !Array.isArray(dessert)) {
    return NextResponse.json(
      { error: "starter, mains, drink, and dessert must be arrays" },
      { status: 400 }
    );
  }

  const date = new Date(`${dateParam}T00:00:00.000Z`);
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  try {
    const menu = await prisma.dailyMenu.upsert({
      where: { date_location: { date, location } },
      create: {
        date,
        location,
        chefName: chefName ?? null,
        announcement: announcement ?? null,
        starter,
        mains,
        drink,
        dessert,
        createdBy: session.user.id,
      },
      update: {
        chefName: chefName ?? null,
        announcement: announcement ?? null,
        starter,
        mains,
        drink,
        dessert,
        createdBy: session.user.id,
      },
    });

    return NextResponse.json(menu);
  } catch (error) {
    console.error("Error saving menu:", error);
    return NextResponse.json({ error: "Failed to save menu" }, { status: 500 });
  }
}
