import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay } from "date-fns";
import { parseISOInNZT, toUTC } from "@/lib/timezone";
import { restaurantNightStatsSchema } from "@/lib/validation-schemas";
import { countNewVolunteers } from "@/lib/service-night-attendance";
import type { Prisma } from "@/generated/client";

// Decimal columns come back as Prisma.Decimal — serialize to plain numbers for JSON.
type MealsServedRecord = Prisma.MealsServedGetPayload<object>;

function serializeStats(record: MealsServedRecord) {
  const toNumber = (v: Prisma.Decimal | null) => (v === null ? null : Number(v));
  return {
    mealsServed: record.mealsServed,
    notes: record.notes,
    weather: record.weather,
    bookingsPax: record.bookingsPax,
    newVolunteers: record.newVolunteers,
    nonPayingCount: record.nonPayingCount,
    vege: record.vege,
    takeaways: record.takeaways,
    eftposTransactions: record.eftposTransactions,
    cash: toNumber(record.cash),
    eftpos: toNumber(record.eftpos),
    stripe: toNumber(record.stripe),
    suggestedValue: toNumber(record.suggestedValue),
    protein: record.protein,
  };
}

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
    // Parse date in NZ timezone and get the UTC bounds of the NZ service day
    const dateNZT = parseISOInNZT(date);
    const startOfDayUTC = toUTC(startOfDay(dateNZT));
    const endOfDayUTC = toUTC(endOfDay(dateNZT));

    // New volunteers are derived live from actual attendance, not entered.
    const newVolunteers = await countNewVolunteers({
      location,
      start: startOfDayUTC,
      end: endOfDayUTC,
    });

    const [mealsRecord, locationConfig] = await Promise.all([
      prisma.mealsServed.findUnique({
        where: {
          date_location: {
            date: startOfDayUTC,
            location,
          },
        },
      }),
      prisma.location.findUnique({ where: { name: location } }),
    ]);

    // Pop-up / special-event venues are koha-manual-only (no Stripe sync).
    const isPopup = locationConfig?.isPopup ?? false;

    // If no record exists, get the default from Location model
    if (!mealsRecord) {
      return NextResponse.json({
        mealsServed: null,
        defaultMealsServed: locationConfig?.defaultMealsServed || 60,
        notes: null,
        newVolunteers,
        isPopup,
      });
    }

    return NextResponse.json({
      ...serializeStats(mealsRecord),
      newVolunteers, // live value overrides the stored snapshot
      defaultMealsServed: null,
      isPopup,
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
    const parsed = restaurantNightStatsSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid request" },
        { status: 400 }
      );
    }

    const { date, location, ...stats } = parsed.data;

    // Require at least one stat/note — don't create empty rows.
    const hasAnyValue = Object.values(stats).some((v) => v !== null);
    if (!hasAnyValue) {
      return NextResponse.json(
        { error: "Enter at least one stat before saving" },
        { status: 400 }
      );
    }

    // Parse date in NZ timezone and get the UTC bounds of the NZ service day
    const dateNZT = parseISOInNZT(date);
    const startOfDayUTC = toUTC(startOfDay(dateNZT));
    const endOfDayUTC = toUTC(endOfDay(dateNZT));

    // New volunteers are derived from attendance, not from the request body.
    const newVolunteers = await countNewVolunteers({
      location,
      start: startOfDayUTC,
      end: endOfDayUTC,
    });

    // Upsert the service-night record
    const mealsRecord = await prisma.mealsServed.upsert({
      where: {
        date_location: {
          date: startOfDayUTC,
          location,
        },
      },
      update: { ...stats, newVolunteers, createdBy: session.user.id },
      create: {
        date: startOfDayUTC,
        location,
        ...stats,
        newVolunteers,
        createdBy: session.user.id,
      },
    });

    return NextResponse.json({
      ...serializeStats(mealsRecord),
      newVolunteers,
    });
  } catch (error) {
    console.error("Error updating meals served:", error);
    return NextResponse.json(
      { error: "Failed to update meals served" },
      { status: 500 }
    );
  }
}
