import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getToken } from "next-auth/jwt";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    // Only admins can impersonate
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Prevent impersonating while already impersonating
    if (session.impersonating) {
      return NextResponse.json(
        { error: "Already impersonating a user" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        firstName: true,
        lastName: true,
        phone: true,
        emailVerified: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get current token to extract admin info
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    // Create a new token with impersonation data
    const impersonationData = {
      adminId: session.user.id,
      adminEmail: session.user.email || "",
      adminName: session.user.name || null,
    };

    // Return data for client to trigger session update
    return NextResponse.json({
      success: true,
      targetUser: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
        role: targetUser.role,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        phone: targetUser.phone,
        emailVerified: targetUser.emailVerified,
      },
      impersonationData,
    });
  } catch (error) {
    console.error("Impersonation error:", error);
    return NextResponse.json(
      { error: "Failed to start impersonation" },
      { status: 500 }
    );
  }
}
