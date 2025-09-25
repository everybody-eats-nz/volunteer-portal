import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { z } from "zod";

const createGroupBookingSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  memberEmails: z.array(z.string().email()).min(1).max(10),
  leaderAssignedToThisShift: z.boolean().optional().default(true),
  memberAssignments: z.record(z.string(), z.string()).optional(), // Now single shift per member
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

    // Extract shift ID from URL
    const url = new URL(req.url);
    const segments = url.pathname.split("/");
    const shiftId = segments[segments.length - 2];

    // Validate request body
    const body = await req.json();
    const validation = createGroupBookingSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { name, description, memberEmails, leaderAssignedToThisShift, memberAssignments } = validation.data;

    // Check if shift exists
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: { signups: true },
    });

    if (!shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    // Check if shift is in the future
    if (shift.start < new Date()) {
      return NextResponse.json(
        { error: "Cannot create group booking for past shifts" },
        { status: 400 }
      );
    }

    // Check if user already has a group booking for this shift
    const existingGroupBooking = await prisma.groupBooking.findUnique({
      where: { shiftId_leaderId: { shiftId, leaderId: user.id } },
    });

    if (existingGroupBooking) {
      return NextResponse.json(
        { error: "You already have a group booking for this shift" },
        { status: 400 }
      );
    }

    // Check if user already has an active individual signup for this shift
    const existingSignup = await prisma.signup.findUnique({
      where: { userId_shiftId: { userId: user.id, shiftId } },
    });

    if (existingSignup && existingSignup.status !== "CANCELED") {
      return NextResponse.json(
        { error: "You already have an individual signup for this shift. Cancel it first to create a group booking." },
        { status: 400 }
      );
    }

    // Remove duplicates and the leader's own email from memberEmails
    const uniqueMemberEmails = Array.from(new Set(memberEmails)).filter(
      email => email.toLowerCase() !== user.email.toLowerCase()
    );

    // Check if adding this group would exceed shift capacity
    const confirmedSignups = shift.signups.filter(s => s.status === "CONFIRMED").length;
    const totalGroupSize = uniqueMemberEmails.length + 1; // +1 for leader
    
    if (confirmedSignups + totalGroupSize > shift.capacity) {
      // Group will go to waitlist, but we still allow creation
      // The admin can decide how to handle capacity
    }

    // Create group booking in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the group booking
      const groupBooking = await tx.groupBooking.create({
        data: {
          name,
          description,
          shiftId,
          leaderId: user.id,
          status: "PENDING",
        },
        include: {
          shift: {
            include: { shiftType: true },
          },
          leader: true,
        },
      });

      // Create the leader's signup only if they're assigned to this shift
      if (leaderAssignedToThisShift) {
        await tx.signup.create({
          data: {
            userId: user.id,
            shiftId,
            status: "PENDING",
            groupBookingId: groupBooking.id,
          },
        });
      }

      // Create invitations for all member emails
      const invitationData = uniqueMemberEmails.map(email => ({
        groupBookingId: groupBooking.id,
        email: email.toLowerCase(),
        invitedById: user.id,
        assignedShiftIds: memberAssignments?.[email] ? [memberAssignments[email]] : [shiftId], // Use single shift assignment or default to current shift
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      }));

      const invitations = await tx.groupInvitation.createMany({
        data: invitationData,
      });

      return {
        groupBooking,
        invitations,
        invitationEmails: uniqueMemberEmails,
      };
    });

    // TODO: Send invitation emails (implement in next step)
    
    return NextResponse.json({
      success: true,
      groupBooking: result.groupBooking,
      invitationsSent: result.invitationEmails.length,
    });

  } catch (error) {
    console.error("Error creating group booking:", error);
    return NextResponse.json(
      { error: "Failed to create group booking" },
      { status: 500 }
    );
  }
}