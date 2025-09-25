import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getEmailService } from "@/lib/email-service";

const approveSchema = z.object({
  notes: z.string().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/parental-consent/[id]/approve
 * Approves parental consent for a volunteer under 18
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { notes } = approveSchema.parse(body);

    // Find the user
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        requiresParentalConsent: true,
        parentalConsentReceived: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (!user.requiresParentalConsent) {
      return NextResponse.json(
        { error: "User does not require parental consent" },
        { status: 400 }
      );
    }

    if (user.parentalConsentReceived) {
      return NextResponse.json(
        { error: "Parental consent already approved" },
        { status: 400 }
      );
    }

    // Update the user to approve parental consent
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        parentalConsentReceived: true,
        parentalConsentReceivedAt: new Date(),
        parentalConsentApprovedBy: session.user.id,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        parentalConsentReceived: true,
        parentalConsentReceivedAt: true,
      },
    });

    // Optionally add admin note about approval
    if (notes) {
      await prisma.adminNote.create({
        data: {
          volunteerId: id,
          content: `Parental consent approved: ${notes}`,
          createdBy: session.user.id,
        },
      });
    }

    // Send approval confirmation email to the volunteer
    try {
      const emailService = getEmailService();
      await emailService.sendParentalConsentApprovalNotification({
        to: updatedUser.email,
        volunteerName: updatedUser.firstName || updatedUser.lastName || 'Volunteer',
      });
    } catch (emailError) {
      console.error("Error sending parental consent approval email:", emailError);
      // Don't fail the approval if email fails
    }

    return NextResponse.json({
      message: "Parental consent approved successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error approving parental consent:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to approve parental consent" },
      { status: 500 }
    );
  }
}