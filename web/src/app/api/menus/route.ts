import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// CORS headers for Webflow and other external consumers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * Public menu endpoint consumed by Webflow.
 *
 * Query params:
 *   location  (required) – e.g. "Wellington"
 *   date      (optional) – YYYY-MM-DD; defaults to today (NZ time via TZ env var)
 *
 * Returns the menu JSON or { menu: null } if none found for that day.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const location = searchParams.get("location");
  const dateParam = searchParams.get("date");

  if (!location) {
    return NextResponse.json(
      { error: "location parameter is required" },
      { status: 400, headers: corsHeaders }
    );
  }

  // Resolve the target date as midnight UTC
  let targetDate: Date;
  if (dateParam) {
    targetDate = new Date(`${dateParam}T00:00:00.000Z`);
    if (isNaN(targetDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD" },
        { status: 400, headers: corsHeaders }
      );
    }
  } else {
    // Default to today in NZ time (TZ env var is Pacific/Auckland)
    const now = new Date();
    const nzDate = now.toLocaleDateString("en-CA", {
      timeZone: process.env.TZ ?? "Pacific/Auckland",
    }); // "YYYY-MM-DD"
    targetDate = new Date(`${nzDate}T00:00:00.000Z`);
  }

  try {
    const menu = await prisma.dailyMenu.findUnique({
      where: { date_location: { date: targetDate, location } },
    });

    if (!menu) {
      return NextResponse.json({ menu: null }, { headers: corsHeaders });
    }

    return NextResponse.json(
      {
        id: menu.id,
        date: menu.date.toISOString().split("T")[0],
        location: menu.location,
        chefName: menu.chefName ?? null,
        announcement: menu.announcement ?? null,
        starter: menu.starter,
        mains: menu.mains,
        drink: menu.drink,
        dessert: menu.dessert,
        updatedAt: menu.updatedAt.toISOString(),
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Error fetching menu:", error);
    return NextResponse.json(
      { error: "Failed to fetch menu" },
      { status: 500, headers: corsHeaders }
    );
  }
}
