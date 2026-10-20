import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { dayKeyToDbDate, shiftDayThemeSchema } from "@/lib/shift-day-themes";

// PUT - Set or clear the theme for one day at one location, or mark the day
// closed (the theme is then the optional reason). An open day with an empty
// theme is removed, so the same call backs both "Save" and "Remove".
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

  const parsed = shiftDayThemeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid request" },
      { status: 400 }
    );
  }

  const { date, location, theme, closed } = parsed.data;

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

    const where = {
      location_date: { location, date: dayKeyToDbDate(date) },
    };

    if (theme === "" && !closed) {
      await prisma.shiftDayTheme.deleteMany({ where: where.location_date });
      return NextResponse.json({ date, location, theme: null, closed: false });
    }

    const saved = await prisma.shiftDayTheme.upsert({
      where,
      update: { theme, closed, updatedBy: session.user.id },
      create: {
        date: dayKeyToDbDate(date),
        location,
        theme,
        closed,
        updatedBy: session.user.id,
      },
    });

    return NextResponse.json({
      date,
      location,
      theme: saved.theme,
      closed: saved.closed,
    });
  } catch (error) {
    console.error("Error saving shift day theme:", error);
    return NextResponse.json(
      { error: "Failed to save the day theme" },
      { status: 500 }
    );
  }
}
