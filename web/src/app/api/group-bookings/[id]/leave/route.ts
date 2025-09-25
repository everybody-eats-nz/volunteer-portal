import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    // Extract group booking ID from URL
    const url = new URL(req.url);
    const segments = url.pathname.split("/");
    const groupBookingId = segments[segments.length - 2];

    // Find the user's signup for this group
    const signup = await prisma.signup.findFirst({
      where: {
        userId: user.id,
        groupBookingId,
      },
      include: {
        groupBooking: {
          include: {
            shift: true,
            leader: {
              select: { name: true, email: true },
            },
          },
        },
      },
    });

    if (!signup) {
      return NextResponse.json({ error: "You are not a member of this group" }, { status: 404 });
    }

    // Check if user is the leader
    if (signup.groupBooking?.leaderId === user.id) {
      return NextResponse.json({ 
        error: "Group leader cannot leave the group. Cancel the group instead.",
      }, { status: 400 });
    }

    // Check if shift is in the future
    if (signup.groupBooking?.shift.start && signup.groupBooking.shift.start < new Date()) {
      return NextResponse.json(
        { error: "Cannot leave group for past shifts" },
        { status: 400 }
      );
    }

    // Check if signup is not already canceled
    if (signup.status === "CANCELED") {
      return NextResponse.json(
        { error: "You have already left this group" },
        { status: 400 }
      );
    }

    // Cancel the user's signup
    await prisma.signup.update({
      where: { id: signup.id },
      data: { status: "CANCELED" },
    });

    // TODO: Send notification email to group leader

    return NextResponse.json({
      success: true,
      message: "Successfully left the group",
    });

  } catch (error) {
    console.error("Error leaving group:", error);
    return NextResponse.json(
      { error: "Failed to leave group" },
      { status: 500 }
    );
  }
}