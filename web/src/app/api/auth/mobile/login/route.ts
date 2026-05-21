import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { signMobileToken, toMobileUser } from "@/lib/mobile-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        profilePhotoUrl: true,
        profileCompleted: true,
        firstName: true,
        lastName: true,
        phone: true,
        dateOfBirth: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        volunteerAgreementAccepted: true,
        healthSafetyPolicyAccepted: true,
        hashedPassword: true,
        archivedAt: true,
      },
    });

    if (!user || !user.hashedPassword || user.archivedAt) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, user.hashedPassword);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Stamp the mobile-login marker so admin UI can tell who's actually on
    // mobile (more reliable than push tokens, which require notification
    // permission). Fire-and-forget — failure here shouldn't block login.
    void prisma.user
      .update({
        where: { id: user.id },
        data: { lastMobileLoginAt: new Date() },
      })
      .catch((err) =>
        console.error("Failed to stamp lastMobileLoginAt on login:", err)
      );

    const token = await signMobileToken(user.id, user.email);

    return NextResponse.json({
      token,
      user: toMobileUser(user),
    });
  } catch (error) {
    console.error("Mobile login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
