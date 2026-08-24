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
    const { userId, shiftId, status = "CONFIRMED", backupForShiftIds = [] } = body;

    const signup = await prisma.signup.create({
      data: {
        userId,
        shiftId,
        status,
        backupForShiftIds,
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
    const { signupId, userId, shiftId, ...updateData } = body;

    // Addressable by id, or by the user/shift pair - tests that create a
    // signup through the UI don't get an id back, and pinning the resulting
    // status is how they stay independent of whatever auto-approval rules
    // happen to be configured in the environment.
    if (!signupId && !(userId && shiftId)) {
      return NextResponse.json(
        { error: "signupId, or userId and shiftId, required" },
        { status: 400 }
      );
    }

    const signup = await prisma.signup.update({
      where: signupId
        ? { id: signupId }
        : { userId_shiftId: { userId, shiftId } },
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
