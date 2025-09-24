import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function POST(req: Request) {
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

    // Extract token from URL
    const url = new URL(req.url);
    const segments = url.pathname.split("/");
    const token = segments[segments.length - 2];

    const invitation = await prisma.groupInvitation.findUnique({
      where: { token },
      include: {
        groupBooking: {
          include: {
            shift: true,
            signups: true,
          },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    // Verify the invitation email matches the current user
    if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json(
        {
          error: "This invitation is not for your email address",
        },
        { status: 403 }
      );
    }

    // Check if invitation has expired
    if (invitation.expiresAt < new Date()) {
      await prisma.groupInvitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json(
        { error: "Invitation has expired" },
        { status: 410 }
      );
    }

    // Check if invitation is still pending
    if (invitation.status !== "PENDING") {
      return NextResponse.json(
        {
          error: `Invitation has already been ${invitation.status.toLowerCase()}`,
        },
        { status: 400 }
      );
    }

    // Check if shift is still in the future
    if (invitation.groupBooking.shift.start < new Date()) {
      return NextResponse.json(
        {
          error: "Cannot accept invitation for past shifts",
        },
        { status: 400 }
      );
    }

    // Check if group booking is still active
    if (invitation.groupBooking.status === "CANCELED") {
      return NextResponse.json(
        {
          error: "Group booking has been canceled",
        },
        { status: 400 }
      );
    }

    // Check if user already has an active signup for this shift
    const existingSignup = await prisma.signup.findUnique({
      where: {
        userId_shiftId: {
          userId: user.id,
          shiftId: invitation.groupBooking.shiftId,
        },
      },
    });

    if (existingSignup && existingSignup.status !== "CANCELED") {
      return NextResponse.json(
        {
          error: "You already have a signup for this shift",
        },
        { status: 400 }
      );
    }

    // Check if group has reached max capacity
    const currentMemberCount = invitation.groupBooking.signups.length;
    if (currentMemberCount >= invitation.groupBooking.maxMembers) {
      return NextResponse.json(
        {
          error: "Group has reached maximum capacity",
        },
        { status: 400 }
      );
    }

    // Accept the invitation and create signup in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update invitation status
      await tx.groupInvitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED" },
      });

      // Create the signup
      const signup = await tx.signup.create({
        data: {
          userId: user.id,
          shiftId: invitation.groupBooking.shiftId,
          status: "PENDING", // Matches group booking status workflow
          groupBookingId: invitation.groupBooking.id,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          shift: {
            include: { shiftType: true },
          },
          groupBooking: {
            include: {
              leader: {
                select: { name: true, email: true },
              },
            },
          },
        },
      });

      return signup;
    });

    // Achievements will be calculated when user visits dashboard/achievements page

    // TODO: Send notification email to group leader

    return NextResponse.json({
      success: true,
      message: "Successfully joined the group!",
      signup: {
        id: result.id,
        status: result.status,
        shift: result.shift,
        groupBooking: {
          id: result.groupBooking?.id,
          name: result.groupBooking?.name,
          leader: result.groupBooking?.leader,
        },
      },
    });
  } catch (error) {
    console.error("Error accepting invitation:", error);
    return NextResponse.json(
      { error: "Failed to accept invitation" },
      { status: 500 }
    );
  }
}
