import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { dayKeyToDbDate } from "@/lib/shift-day-themes";
import { dayLeadOverrideSchema } from "@/lib/day-leads";

// PUT - Set one day's Chef and FOH Manager where they differ from the standard
// roster (a swap or a cover). An empty name puts that role back on the
// standard roster, and with both empty the day's override is removed.
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

  const parsed = dayLeadOverrideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid request" },
      { status: 400 }
    );
  }

  const { date, location } = parsed.data;
  const chef = parsed.data.chef || null;
  const fohManager = parsed.data.fohManager || null;

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

    const day = { location, date: dayKeyToDbDate(date) };

    if (!chef && !fohManager) {
      await prisma.dayLeadOverride.deleteMany({ where: day });
      return NextResponse.json({
        date,
        location,
        override: { chef: null, fohManager: null },
      });
    }

    const saved = await prisma.dayLeadOverride.upsert({
      where: { location_date: day },
      update: { chef, fohManager, updatedBy: session.user.id },
      create: { ...day, chef, fohManager, updatedBy: session.user.id },
    });

    return NextResponse.json({
      date,
      location,
      override: { chef: saved.chef, fohManager: saved.fohManager },
    });
  } catch (error) {
    console.error("Error saving day leads:", error);
    return NextResponse.json(
      { error: "Failed to save the chef and FOH manager" },
      { status: 500 }
    );
  }
}
