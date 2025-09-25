import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { z } from "zod";

const updateGroupBookingSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

export async function GET(req: Request) {
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
    const groupBookingId = segments[segments.length - 1];

    const groupBooking = await prisma.groupBooking.findUnique({
      where: { id: groupBookingId },
      include: {
        shift: {
          include: { shiftType: true },
        },
        leader: {
          select: { id: true, name: true, email: true },
        },
        signups: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        invitations: {
          include: {
            invitedBy: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!groupBooking) {
      return NextResponse.json(
        { error: "Group booking not found" },
        { status: 404 }
      );
    }

    // Check if user has permission to view this group
    const isLeader = groupBooking.leaderId === user.id;
    const isMember = groupBooking.signups.some(
      (signup) => signup.userId === user.id
    );
    const isInvited = groupBooking.invitations.some(
      (inv) => inv.email === user.email
    );
    const isAdmin = user.role === "ADMIN";

    if (!isLeader && !isMember && !isInvited && !isAdmin) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json(groupBooking);
  } catch (error) {
    console.error("Error fetching group booking:", error);
    return NextResponse.json(
      { error: "Failed to fetch group booking" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
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
    const groupBookingId = segments[segments.length - 1];

    // Validate request body
    const body = await req.json();
    const validation = updateGroupBookingSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error.issues },
        { status: 400 }
      );
    }

    const updateData = validation.data;

    // Check if group booking exists and user is the leader
    const groupBooking = await prisma.groupBooking.findUnique({
      where: { id: groupBookingId },
      include: { shift: true },
    });

    if (!groupBooking) {
      return NextResponse.json(
        { error: "Group booking not found" },
        { status: 404 }
      );
    }

    if (groupBooking.leaderId !== user.id) {
      return NextResponse.json(
        { error: "Only group leader can update group booking" },
        { status: 403 }
      );
    }

    // Don't allow updates to confirmed or canceled groups
    if (
      groupBooking.status === "CONFIRMED" ||
      groupBooking.status === "CANCELED"
    ) {
      return NextResponse.json(
        { error: "Cannot update confirmed or canceled group bookings" },
        { status: 400 }
      );
    }

    // Check if shift is in the future
    if (groupBooking.shift.start < new Date()) {
      return NextResponse.json(
        { error: "Cannot update group booking for past shifts" },
        { status: 400 }
      );
    }

    // Update group booking
    const updatedGroupBooking = await prisma.groupBooking.update({
      where: { id: groupBookingId },
      data: updateData,
      include: {
        shift: {
          include: { shiftType: true },
        },
        leader: {
          select: { id: true, name: true, email: true },
        },
        signups: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        invitations: true,
      },
    });

    return NextResponse.json(updatedGroupBooking);
  } catch (error) {
    console.error("Error updating group booking:", error);
    return NextResponse.json(
      { error: "Failed to update group booking" },
      { status: 500 }
    );
  }
}

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
    const groupBookingId = segments[segments.length - 1];

    // Check if group booking exists and user is the leader
    const groupBooking = await prisma.groupBooking.findUnique({
      where: { id: groupBookingId },
      include: { shift: true, signups: true },
    });

    if (!groupBooking) {
      return NextResponse.json(
        { error: "Group booking not found" },
        { status: 404 }
      );
    }

    const isLeader = groupBooking.leaderId === user.id;
    const isAdmin = user.role === "ADMIN";

    if (!isLeader && !isAdmin) {
      return NextResponse.json(
        { error: "Only group leader or admin can cancel group booking" },
        { status: 403 }
      );
    }

    // Check if shift is in the future (allow admin to cancel past shifts)
    if (groupBooking.shift.start < new Date() && !isAdmin) {
      return NextResponse.json(
        { error: "Cannot cancel group booking for past shifts" },
        { status: 400 }
      );
    }

    // Cancel the group booking in a transaction
    await prisma.$transaction(async (tx) => {
      // Update group booking status to CANCELED
      await tx.groupBooking.update({
        where: { id: groupBookingId },
        data: { status: "CANCELED" },
      });

      // Cancel all related signups
      await tx.signup.updateMany({
        where: { groupBookingId },
        data: { status: "CANCELED" },
      });

      // Cancel all pending invitations
      await tx.groupInvitation.updateMany({
        where: {
          groupBookingId,
          status: "PENDING",
        },
        data: { status: "CANCELED" },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Group booking canceled successfully",
    });
  } catch (error) {
    console.error("Error canceling group booking:", error);
    return NextResponse.json(
      { error: "Failed to cancel group booking" },
      { status: 500 }
    );
  }
}
