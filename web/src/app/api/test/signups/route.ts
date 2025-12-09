import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Test-only endpoint for managing signups
 * Only available in development/test environments
 */

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { userId, shiftId, status = "CONFIRMED" } = body;

    const signup = await prisma.signup.create({
      data: {
        userId,
        shiftId,
        status,
      },
    });

    return NextResponse.json(signup);
  } catch (error) {
    console.error("Error creating signup:", error);
    return NextResponse.json(
      { error: "Failed to create signup" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const shiftIds = searchParams.get("shiftIds")?.split(",");
    const userId = searchParams.get("userId");

    if (shiftIds) {
      await prisma.signup.deleteMany({
        where: { shiftId: { in: shiftIds } },
      });
    } else if (userId) {
      await prisma.signup.deleteMany({
        where: { userId },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting signups:", error);
    return NextResponse.json(
      { error: "Failed to delete signups" },
      { status: 500 }
    );
  }
}
