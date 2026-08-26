import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { createShiftRecord } from "@/lib/services/shift-service";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/client";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    let { shiftTypeId } = body;
    const { location, start, end, capacity, notes, templateId } = body;

    // If no shiftTypeId provided, find or create a default one for tests.
    // upsert() isn't atomic against a concurrent insert of the same row:
    // under e2e's parallel load, two requests can both see no existing
    // "Kitchen" row and both attempt the create side, and the loser still
    // surfaces a raw P2002 instead of transparently retrying as an update.
    // When that happens the winner's row now exists, so just read it.
    if (!shiftTypeId) {
      try {
        const defaultShiftType = await prisma.shiftType.upsert({
          where: { name: "Kitchen" },
          update: {},
          create: {
            name: "Kitchen",
            description: "Kitchen duties",
          },
        });

        shiftTypeId = defaultShiftType.id;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          const existing = await prisma.shiftType.findUniqueOrThrow({
            where: { name: "Kitchen" },
          });
          shiftTypeId = existing.id;
        } else {
          throw error;
        }
      }
    }

    const shift = await createShiftRecord({
      shiftTypeId,
      location,
      start: new Date(start),
      end: new Date(end),
      capacity,
      notes: notes || null,
      templateId: templateId || null,
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
