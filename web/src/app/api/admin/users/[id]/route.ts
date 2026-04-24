import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { z } from "zod";
import { deleteUserCascade } from "@/lib/user-service";

const deleteUserSchema = z.object({
  confirmEmail: z.string().email("Please enter a valid email address"),
});

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!currentUser || currentUser.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    );
  }

  const { id: userId } = await params;

  if (!userId) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const validatedData = deleteUserSchema.parse(body);

    // Check if the target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent users from deleting themselves
    if (currentUser.id === targetUser.id) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      );
    }

    // Verify email confirmation matches target user's email
    if (validatedData.confirmEmail.toLowerCase() !== targetUser.email.toLowerCase()) {
      return NextResponse.json(
        { error: "Email confirmation does not match the user's email address" },
        { status: 400 }
      );
    }

    await deleteUserCascade(userId);

    return NextResponse.json({
      message: "User deleted successfully",
      deletedUser: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name || `${targetUser.firstName || ""} ${targetUser.lastName || ""}`.trim(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }

    console.error("User deletion error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}