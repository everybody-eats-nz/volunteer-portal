import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    // Extract token from URL
    const url = new URL(req.url);
    const segments = url.pathname.split("/");
    const token = segments[segments.length - 1];

    const invitation = await prisma.groupInvitation.findUnique({
      where: { token },
      include: {
        groupBooking: {
          include: {
            shift: {
              include: { shiftType: true },
            },
            leader: {
              select: { name: true, email: true },
            },
            signups: {
              include: {
                user: {
                  select: { name: true, email: true },
                },
              },
            },
          },
        },
        invitedBy: {
          select: { name: true, email: true },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    // Check if invitation has expired
    if (invitation.expiresAt < new Date()) {
      // Mark as expired if not already
      if (invitation.status === "PENDING") {
        await prisma.groupInvitation.update({
          where: { id: invitation.id },
          data: { status: "EXPIRED" },
        });
      }
      return NextResponse.json({ error: "Invitation has expired" }, { status: 410 });
    }

    // Check if invitation is still pending
    if (invitation.status !== "PENDING") {
      return NextResponse.json({ 
        error: `Invitation has already been ${invitation.status.toLowerCase()}`,
        status: invitation.status,
      }, { status: 400 });
    }

    // Check if shift is still in the future
    if (invitation.groupBooking.shift.start < new Date()) {
      return NextResponse.json({ 
        error: "Cannot accept invitation for past shifts",
      }, { status: 400 });
    }

    // Check if group booking is still active
    if (invitation.groupBooking.status === "CANCELED") {
      return NextResponse.json({ 
        error: "Group booking has been canceled",
      }, { status: 400 });
    }

    return NextResponse.json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        message: invitation.message,
        expiresAt: invitation.expiresAt,
        status: invitation.status,
      },
      groupBooking: {
        id: invitation.groupBooking.id,
        name: invitation.groupBooking.name,
        description: invitation.groupBooking.description,
        status: invitation.groupBooking.status,
        memberCount: invitation.groupBooking.signups.length,
        maxMembers: invitation.groupBooking.maxMembers,
      },
      shift: {
        id: invitation.groupBooking.shift.id,
        start: invitation.groupBooking.shift.start,
        end: invitation.groupBooking.shift.end,
        location: invitation.groupBooking.shift.location,
        capacity: invitation.groupBooking.shift.capacity,
        shiftType: invitation.groupBooking.shift.shiftType,
      },
      leader: invitation.groupBooking.leader,
      invitedBy: invitation.invitedBy,
    });

  } catch (error) {
    console.error("Error fetching invitation:", error);
    return NextResponse.json(
      { error: "Failed to fetch invitation" },
      { status: 500 }
    );
  }
}