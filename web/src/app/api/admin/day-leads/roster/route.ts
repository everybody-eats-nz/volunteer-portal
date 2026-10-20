import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { dayLeadRosterSchema, type DayLeads } from "@/lib/day-leads";

// PUT - Replace a location's standard weekly roster of Chefs and FOH
// Managers. Every service day without its own override follows it, so a
// change here reaches all of those days at once, past and future.
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = dayLeadRosterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid request" },
      { status: 400 }
    );
  }

  const { location } = parsed.data;
  const days = parsed.data.days
    .map((day) => ({
      dayOfWeek: day.dayOfWeek,
      chef: day.chef || null,
      fohManager: day.fohManager || null,
    }))
    .filter((day) => day.chef || day.fohManager);

  try {
    const locationRow = await prisma.location.findUnique({
      where: { name: location },
      select: { id: true },
    });
    if (!locationRow) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      );
    }

    await prisma.$transaction([
      prisma.dayLeadRoster.deleteMany({
        where: {
          location,
          dayOfWeek: { notIn: days.map((day) => day.dayOfWeek) },
        },
      }),
      ...days.map((day) =>
        prisma.dayLeadRoster.upsert({
          where: {
            location_dayOfWeek: { location, dayOfWeek: day.dayOfWeek },
          },
          update: {
            chef: day.chef,
            fohManager: day.fohManager,
            updatedBy: session.user.id,
          },
          create: { location, ...day, updatedBy: session.user.id },
        })
      ),
    ]);

    const roster: Record<number, DayLeads> = {};
    for (const day of days) {
      roster[day.dayOfWeek] = { chef: day.chef, fohManager: day.fohManager };
    }
    return NextResponse.json({ location, roster });
  } catch (error) {
    console.error("Error saving the day lead roster:", error);
    return NextResponse.json(
      { error: "Failed to save the standard roster" },
      { status: 500 }
    );
  }
}
