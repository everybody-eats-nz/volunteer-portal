import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { z } from "zod";

const inviteSchema = z.object({
  emails: z.array(z.string().email()).min(1).max(5),
  message: z.string().max(500).optional(),
});

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

    // Extract group booking ID from URL
    const url = new URL(req.url);
    const segments = url.pathname.split("/");
    const groupBookingId = segments[segments.length - 2];

    // Validate request body
    const body = await req.json();
    const validation = inviteSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { emails, message } = validation.data;

    // Check if group booking exists and user is the leader
    const groupBooking = await prisma.groupBooking.findUnique({
      where: { id: groupBookingId },
      include: {
        shift: true,
        invitations: true,
        signups: true,
      },
    });

    if (!groupBooking) {
      return NextResponse.json({ error: "Group booking not found" }, { status: 404 });
    }

    if (groupBooking.leaderId !== user.id) {
      return NextResponse.json({ error: "Only group leader can send invitations" }, { status: 403 });
    }

    // Don't allow invitations for canceled groups
    if (groupBooking.status === "CANCELED") {
      return NextResponse.json(
        { error: "Cannot send invitations for canceled group bookings" },
        { status: 400 }
      );
    }

    // Check if shift is in the future
    if (groupBooking.shift.start < new Date()) {
      return NextResponse.json(
        { error: "Cannot send invitations for past shifts" },
        { status: 400 }
      );
    }

    // Normalize emails and remove duplicates
    const normalizedEmails = Array.from(new Set(
      emails.map(email => email.toLowerCase())
    ));

    // Remove leader's own email
    const validEmails = normalizedEmails.filter(
      email => email !== user.email.toLowerCase()
    );

    if (validEmails.length === 0) {
      return NextResponse.json(
        { error: "No valid emails to invite" },
        { status: 400 }
      );
    }

    // Check current group size and max members
    const currentMemberCount = groupBooking.signups.length;
    const pendingInvitations = groupBooking.invitations.filter(inv => inv.status === "PENDING").length;
    const totalPotentialMembers = currentMemberCount + pendingInvitations + validEmails.length;

    if (totalPotentialMembers > groupBooking.maxMembers) {
      return NextResponse.json(
        { 
          error: `Group would exceed maximum size of ${groupBooking.maxMembers} members`,
          currentMembers: currentMemberCount,
          pendingInvitations,
          maxMembers: groupBooking.maxMembers,
        },
        { status: 400 }
      );
    }

    // Filter out emails that already have invitations
    const existingInvitations = new Set(groupBooking.invitations.map(inv => inv.email));

    const newEmails = validEmails.filter(email => 
      !existingInvitations.has(email)
    );

    if (newEmails.length === 0) {
      return NextResponse.json(
        { error: "All provided emails already have invitations" },
        { status: 400 }
      );
    }

    // Create invitations
    const invitationData = newEmails.map(email => ({
      groupBookingId,
      email,
      invitedById: user.id,
      message,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    }));

    await prisma.groupInvitation.createMany({
      data: invitationData,
    });

    // Get the created invitations with full details
    const invitations = await prisma.groupInvitation.findMany({
      where: {
        groupBookingId,
        email: { in: newEmails },
        invitedById: user.id,
        status: "PENDING",
      },
      include: {
        groupBooking: {
          include: {
            shift: { include: { shiftType: true } },
            leader: { select: { name: true, email: true } },
          },
        },
      },
    });

    // TODO: Send invitation emails (implement in next step)

    return NextResponse.json({
      success: true,
      invitationsSent: newEmails.length,
      invitations: invitations.map(inv => ({
        id: inv.id,
        email: inv.email,
        token: inv.token,
        expiresAt: inv.expiresAt,
      })),
    });

  } catch (error) {
    console.error("Error sending invitations:", error);
    return NextResponse.json(
      { error: "Failed to send invitations" },
      { status: 500 }
    );
  }
}