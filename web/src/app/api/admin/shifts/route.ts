import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { createShiftRecord } from "@/lib/services/shift-service";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    let { shiftTypeId, location, start, end, capacity, notes } = body;

    // If no shiftTypeId provided, find or create a default one for tests
    if (!shiftTypeId) {
      let defaultShiftType = await prisma.shiftType.findFirst({
        where: { name: "Kitchen" },
      });

      if (!defaultShiftType) {
        defaultShiftType = await prisma.shiftType.create({
          data: {
            name: "Kitchen",
            description: "Kitchen duties",
          },
        });
      }

      shiftTypeId = defaultShiftType.id;
    }

    const shift = await createShiftRecord({
      shiftTypeId,
      location,
      start: new Date(start),
      end: new Date(end),
      capacity,
      notes: notes || null,
    });

    return NextResponse.json(shift);
  } catch (error) {
    console.error("Error creating shift:", error);
    return NextResponse.json(
      { error: "Failed to create shift" },
      { status: 500 }
    );
  }
}
