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
    let { shiftTypeId } = body;
    const { location, start, end, capacity, notes } = body;

    // If no shiftTypeId provided, find or create a default one for tests.
    // Use an atomic upsert on the unique `name` field: a non-atomic
    // findFirst-then-create races when e2e tests run in parallel, with the
    // losing request failing on the ShiftType.name unique constraint.
    if (!shiftTypeId) {
      const defaultShiftType = await prisma.shiftType.upsert({
        where: { name: "Kitchen" },
        update: {},
        create: {
          name: "Kitchen",
          description: "Kitchen duties",
        },
      });

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
