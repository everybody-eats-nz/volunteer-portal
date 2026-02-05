import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { executeUserMerge } from "@/lib/user-merge";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminUser = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!adminUser || adminUser.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { targetUserId, sourceUserId, confirmEmail } = body;

    if (!targetUserId || !sourceUserId) {
      return NextResponse.json(
        { error: "Both targetUserId and sourceUserId are required" },
        { status: 400 }
      );
    }

    if (!confirmEmail) {
      return NextResponse.json(
        { error: "confirmEmail is required for verification" },
        { status: 400 }
      );
    }

    if (targetUserId === sourceUserId) {
      return NextResponse.json(
        { error: "Cannot merge a user with themselves" },
        { status: 400 }
      );
    }

    // Verify the source user exists and confirmEmail matches
    const sourceUser = await prisma.user.findUnique({
      where: { id: sourceUserId },
      select: { email: true },
    });

    if (!sourceUser) {
      return NextResponse.json(
        { error: "Source user not found" },
        { status: 404 }
      );
    }

    if (sourceUser.email.toLowerCase() !== confirmEmail.trim().toLowerCase()) {
      return NextResponse.json(
        { error: "Confirmation email does not match source user's email" },
        { status: 400 }
      );
    }

    // Execute the merge
    const result = await executeUserMerge(
      targetUserId,
      sourceUserId,
      adminUser.id
    );

    return NextResponse.json({
      success: true,
      message: `Successfully merged ${result.deletedSourceEmail} into ${result.targetUser.email}`,
      stats: result.stats,
      targetUser: result.targetUser,
      deletedSourceEmail: result.deletedSourceEmail,
    });
  } catch (error) {
    console.error("User merge error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to merge users";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
