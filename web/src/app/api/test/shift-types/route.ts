import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Test-only endpoint for getting shift types
 * Only available in development/test environments
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");

    if (!name) {
      return NextResponse.json(
        { error: "Name parameter required" },
        { status: 400 }
      );
    }

    const shiftType = await prisma.shiftType.findFirst({
      where: { name },
    });

    if (!shiftType) {
      return NextResponse.json(
        { error: "Shift type not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(shiftType);
  } catch (error) {
    console.error("Error getting shift type:", error);
    return NextResponse.json(
      { error: "Failed to get shift type" },
      { status: 500 }
    );
  }
}
