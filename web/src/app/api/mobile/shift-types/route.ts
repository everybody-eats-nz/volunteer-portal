import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";

/**
 * GET /api/mobile/shift-types
 *
 * Returns all shift types (id + name) for the authenticated mobile user.
 * Used for shortage notification preference checkboxes.
 */
export async function GET(request: Request) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const shiftTypes = await prisma.shiftType.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(shiftTypes);
  } catch (error) {
    console.error("Error fetching shift types:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
