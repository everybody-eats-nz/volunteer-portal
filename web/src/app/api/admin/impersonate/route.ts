import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

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

    if (typeof userId !== "string" || !userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // This route is a pre-check so the button can show a useful error. It
    // grants nothing: the session is switched by the NextAuth jwt callback,
    // which repeats the admin check against the database
    // (src/lib/impersonation.ts).
    return NextResponse.json({ success: true, targetUserId: targetUser.id });
  } catch (error) {
    console.error("Impersonation error:", error);
    return NextResponse.json(
      { error: "Failed to start impersonation" },
      { status: 500 }
    );
  }
}
