import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { startOfDay } from "date-fns";
import { parseISOInNZT, toUTC } from "@/lib/timezone";

// GET - Fetch meals served for a specific date and location
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const date = searchParams.get("date");
  const location = searchParams.get("location");

  if (!date || !location) {
    return NextResponse.json(
      { error: "Date and location are required" },
      { status: 400 }
    );
  }

  try {
    // Parse date in NZ timezone and get start of day in UTC
    const dateNZT = parseISOInNZT(date);
    const startOfDayNZT = startOfDay(dateNZT);
    const startOfDayUTC = toUTC(startOfDayNZT);

    const mealsRecord = await prisma.mealsServed.findUnique({
      where: {
        date_location: {
          date: startOfDayUTC,
          location,
        },
      },
    });

    // If no record exists, get the default from Location model
    if (!mealsRecord) {
      const locationConfig = await prisma.location.findUnique({
        where: { name: location },
      });

      return NextResponse.json({
        mealsServed: null,
        defaultMealsServed: locationConfig?.defaultMealsServed || 60,
        notes: null,
      });
    }

    return NextResponse.json({
      mealsServed: mealsRecord.mealsServed,
      defaultMealsServed: null,
      notes: mealsRecord.notes,
    });
  } catch (error) {
    console.error("Error fetching meals served:", error);
    return NextResponse.json(
      { error: "Failed to fetch meals served" },
      { status: 500 }
    );
  }
}

// POST/PUT - Update or create meals served record
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { date, location, mealsServed, notes } = body;

    if (!date || !location || mealsServed === undefined) {
      return NextResponse.json(
        { error: "Date, location, and mealsServed are required" },
        { status: 400 }
      );
    }

    // Parse date in NZ timezone and get start of day in UTC
    const dateNZT = parseISOInNZT(date);
    const startOfDayNZT = startOfDay(dateNZT);
    const startOfDayUTC = toUTC(startOfDayNZT);

    // Upsert the meals served record
    const mealsRecord = await prisma.mealsServed.upsert({
      where: {
        date_location: {
          date: startOfDayUTC,
          location,
        },
      },
      update: {
        mealsServed: parseInt(mealsServed),
        notes: notes || null,
        createdBy: session.user.id,
      },
      create: {
        date: startOfDayUTC,
        location,
        mealsServed: parseInt(mealsServed),
        notes: notes || null,
        createdBy: session.user.id,
      },
    });

    return NextResponse.json(mealsRecord);
  } catch (error) {
    console.error("Error updating meals served:", error);
    return NextResponse.json(
      { error: "Failed to update meals served" },
      { status: 500 }
    );
  }
}
