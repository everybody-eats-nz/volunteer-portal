import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { z } from "zod";

const updateGroupBookingStatusSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "WAITLISTED", "CANCELED", "PARTIAL"]),
  notes: z.string().optional(),
});

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true },
    });

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Extract group booking ID from URL
    const url = new URL(req.url);
    const segments = url.pathname.split("/");
    const groupBookingId = segments[segments.indexOf("group-bookings") + 1];

    // Validate request body
    const body = await req.json();
    const validation = updateGroupBookingStatusSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { status, notes } = validation.data;

    // Check if group booking exists
    const groupBooking = await prisma.groupBooking.findUnique({
      where: { id: groupBookingId },
      include: { 
        shift: true,
        signups: { 
          include: { 
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                profileCompleted: true,
                firstName: true,
                lastName: true,
                phone: true,
                emergencyContactName: true,
                emergencyContactPhone: true,
                volunteerAgreementAccepted: true,
                healthSafetyPolicyAccepted: true,
              }
            } 
          } 
        },
        invitations: true,
      },
    });

    if (!groupBooking) {
      return NextResponse.json({ error: "Group booking not found" }, { status: 404 });
    }

    // If attempting to confirm, check that all members have completed registration
    if (status === "CONFIRMED") {
      // First, check if there are any pending invitations (people who haven't joined yet)
      const pendingInvitations = groupBooking.invitations.filter(inv => inv.status === "PENDING");
      
      if (pendingInvitations.length > 0) {
        const pendingEmails = pendingInvitations.map(inv => inv.email).join(", ");
        return NextResponse.json(
          { 
            error: "Cannot approve group - some invited members have not joined yet",
            pendingInvitations: pendingEmails,
            details: "All invited members must accept their invitations and create accounts before the group can be approved."
          },
          { status: 400 }
        );
      }

      // Then, check that all members who have joined have completed their profiles
      const incompleteMembers = groupBooking.signups.filter(signup => {
        const user = signup.user;
        // Check if user has completed their profile
        const hasBasicInfo = user.firstName && user.lastName && user.phone;
        const hasEmergencyContact = user.emergencyContactName && user.emergencyContactPhone;
        const hasAgreements = user.volunteerAgreementAccepted && user.healthSafetyPolicyAccepted;
        const isProfileComplete = user.profileCompleted || (hasBasicInfo && hasEmergencyContact && hasAgreements);
        
        return !isProfileComplete;
      });

      if (incompleteMembers.length > 0) {
        const incompleteEmails = incompleteMembers.map(s => s.user.email).join(", ");
        return NextResponse.json(
          { 
            error: "Cannot approve group - some members have not completed registration",
            incompleteMembers: incompleteEmails,
            details: "All group members must complete their profile including emergency contacts and accept agreements before the group can be approved."
          },
          { status: 400 }
        );
      }
    }

    // Update group booking and related signups in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update group booking status
      const updatedGroupBooking = await tx.groupBooking.update({
        where: { id: groupBookingId },
        data: { 
          status,
          notes,
          updatedAt: new Date(),
        },
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

      // Update all related signups to match group status
      let signupStatus: "PENDING" | "CONFIRMED" | "WAITLISTED" | "CANCELED";
      
      switch (status) {
        case "CONFIRMED":
          signupStatus = "CONFIRMED";
          break;
        case "WAITLISTED":
          signupStatus = "WAITLISTED";
          break;
        case "CANCELED":
          signupStatus = "CANCELED";
          // Also cancel pending invitations
          await tx.groupInvitation.updateMany({
            where: { 
              groupBookingId,
              status: "PENDING",
            },
            data: { status: "CANCELED" },
          });
          break;
        case "PENDING":
        case "PARTIAL":
        default:
          signupStatus = "PENDING";
          break;
      }

      // Update all signups in the group (unless it's PARTIAL status)
      if (status !== "PARTIAL") {
        await tx.signup.updateMany({
          where: { groupBookingId },
          data: { status: signupStatus },
        });
      }

      // If confirmed, create automatic friendships between all group members
      if (status === "CONFIRMED" && updatedGroupBooking.signups.length > 1) {
        const memberIds = updatedGroupBooking.signups.map(signup => signup.userId);
        
        // Create bidirectional friendships between all members
        for (let i = 0; i < memberIds.length; i++) {
          for (let j = i + 1; j < memberIds.length; j++) {
            const userId1 = memberIds[i];
            const userId2 = memberIds[j];
            
            // Check if friendship already exists
            const existingFriendship = await tx.friendship.findFirst({
              where: {
                OR: [
                  { userId: userId1, friendId: userId2 },
                  { userId: userId2, friendId: userId1 },
                ],
              },
            });
            
            if (!existingFriendship) {
              // Create bidirectional friendship
              await tx.friendship.create({
                data: {
                  userId: userId1,
                  friendId: userId2,
                  status: "ACCEPTED",
                  initiatedBy: userId1, // Group leader initiated this
                },
              });
              
              await tx.friendship.create({
                data: {
                  userId: userId2,
                  friendId: userId1,
                  status: "ACCEPTED",
                  initiatedBy: userId1, // Group leader initiated this
                },
              });
            }
          }
        }
      }

      return updatedGroupBooking;
    });

    // TODO: Send notification emails to group members about status change
    // TODO: Send notification about new automatic friendships when confirmed

    return NextResponse.json({
      success: true,
      groupBooking: result,
      message: `Group booking ${status.toLowerCase()} successfully`,
    });

  } catch (error) {
    console.error("Error updating group booking status:", error);
    return NextResponse.json(
      { error: "Failed to update group booking status" },
      { status: 500 }
    );
  }
}