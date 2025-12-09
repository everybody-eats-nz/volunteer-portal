import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";

/**
 * Test-only endpoint for creating users with specific roles
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
      password = "Test123456",
      role = "VOLUNTEER",
      firstName = "Test",
      lastName = "User",
      profileCompleted = true,
      ...additionalData
    } = body;

    // Delete existing user first to avoid conflicts
    await prisma.user.deleteMany({
      where: { email },
    });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        hashedPassword,
        role,
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
        profileCompleted,
        ...additionalData,
      },
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
