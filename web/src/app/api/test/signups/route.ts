import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Test-only endpoint for managing signups
 * Only available in development/test environments
 */

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const signupId = searchParams.get("signupId");

    if (!signupId) {
      return NextResponse.json(
        { error: "signupId required" },
        { status: 400 }
      );
    }

    const signup = await prisma.signup.findUnique({
      where: { id: signupId },
      include: { shift: true, user: true },
    });

    if (!signup) {
      return NextResponse.json({ error: "Signup not found" }, { status: 404 });
    }

    return NextResponse.json(signup);
  } catch (error) {
    console.error("Error getting signup:", error);
    return NextResponse.json(
      { error: "Failed to get signup" },
      { status: 500 }
    );
  }
}

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

export async function PATCH(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { signupId, ...updateData } = body;

    if (!signupId) {
      return NextResponse.json(
        { error: "signupId required" },
        { status: 400 }
      );
    }

    const signup = await prisma.signup.update({
      where: { id: signupId },
      data: updateData,
    });

    return NextResponse.json(signup);
  } catch (error) {
    console.error("Error updating signup:", error);
    return NextResponse.json(
      { error: "Failed to update signup" },
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
