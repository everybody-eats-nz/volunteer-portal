import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";

/**
 * GET endpoint to retrieve user by email
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error getting user:", error);
    return NextResponse.json({ error: "Failed to get user" }, { status: 500 });
  }
}

/**
 * Test-only endpoint for creating users with specific roles and states
 * Only available in development/test environments
 */
export async function POST(request: NextRequest) {
  // Only allow in non-production environments
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const {
      email,
      password,
      role = "VOLUNTEER",
      firstName = "Test",
      lastName = "User",
      profileCompleted = true,
      isMigrationUser = false,
      ...additionalData
    } = body;

    // Delete existing user first to avoid conflicts
    await prisma.user.deleteMany({
      where: { email },
    });

    // For migration users, don't set password or profileCompleted
    const userData = {
      email,
      role,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      ...additionalData,
    };

    if (isMigrationUser) {
      // Migration users need to complete registration
      userData.profileCompleted = false;
      userData.hashedPassword = null;
    } else {
      // Regular users get a password and completed profile
      userData.hashedPassword = await bcrypt.hash(password || "Test123456", 10);
      userData.profileCompleted = profileCompleted;
    }

    const user = await prisma.user.create({
      data: userData,
    });

    return NextResponse.json({ id: user.id, email: user.email });
  } catch (error) {
    console.error("Error creating test user:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}

/**
 * DELETE endpoint to clean up test users
 */
export async function DELETE(request: NextRequest) {
  // Only allow in non-production environments
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (email) {
      await prisma.user.deleteMany({
        where: { email },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting test user:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
