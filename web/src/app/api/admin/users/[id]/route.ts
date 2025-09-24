import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { z } from "zod";

const deleteUserSchema = z.object({
  confirmEmail: z.string().email("Please enter a valid email address"),
});

export async function DELETE(req: Request) {
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

  // Extract user ID from the URL
  const url = new URL(req.url);
  const segments = url.pathname.split("/");
  const userId = segments[segments.indexOf("users") + 1];

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

    // Delete related records first, then the user
    // Use a transaction to ensure all deletions succeed or fail together
    await prisma.$transaction(async (tx) => {
      // Delete signups first
      await tx.signup.deleteMany({
        where: { userId: userId },
      });

      // Delete group invitations sent by this user
      await tx.groupInvitation.deleteMany({
        where: { invitedById: userId },
      });

      // Delete group bookings created by this user (as leader)
      await tx.groupBooking.deleteMany({
        where: { leaderId: userId },
      });

      // Delete admin notes about this user
      await tx.adminNote.deleteMany({
        where: { volunteerId: userId },
      });

      // Delete admin notes created by this user (if they're an admin)
      await tx.adminNote.deleteMany({
        where: { createdBy: userId },
      });

      // Delete user achievements
      await tx.userAchievement.deleteMany({
        where: { userId: userId },
      });

      // Delete custom label assignments
      await tx.userCustomLabel.deleteMany({
        where: { userId: userId },
      });

      // Delete friend requests sent by this user
      await tx.friendRequest.deleteMany({
        where: { fromUserId: userId },
      });

      // Delete friendships where this user is involved
      await tx.friendship.deleteMany({
        where: {
          OR: [
            { userId: userId },
            { friendId: userId }
          ]
        },
      });

      // Delete notifications for this user
      await tx.notification.deleteMany({
        where: { userId: userId },
      });

      // Delete notification group memberships
      await tx.notificationGroupMember.deleteMany({
        where: { userId: userId },
      });

      // Finally delete the user
      await tx.user.delete({
        where: { id: userId },
      });
    });

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