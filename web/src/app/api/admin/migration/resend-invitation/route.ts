import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import { getEmailService } from "@/lib/email-service";

interface InvitationWebhookData {
  email: string;
  firstName: string;
  lastName: string;
  registrationLink: string;
}

async function sendInvitationWebhook(
  data: InvitationWebhookData
): Promise<boolean> {
  try {
    const emailService = getEmailService();
    await emailService.sendMigrationInvite({
      to: data.email,
      firstName: data.firstName,
      migrationLink: data.registrationLink,
    });
    console.log(`📧 Resent migration invitation email to: ${data.email}`);
    return true;
  } catch (error) {
    console.error("Error resending migration invitation email:", error);
    // Fallback to webhook if Campaign Monitor fails
    const webhookUrl = process.env.EMAIL_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.EMAIL_WEBHOOK_TOKEN || ""}`,
          },
          body: JSON.stringify({
            type: "migration_invitation_resend",
            data,
          }),
        });
        return response.ok;
      } catch (webhookError) {
        console.error("Webhook fallback error:", webhookError);
      }
    }
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
        profileCompleted: false,
        role: "VOLUNTEER",
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        migrationInvitationSent: true,
        migrationInvitationSentAt: true,
        migrationInvitationToken: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found or not eligible for invitation" },
        { status: 400 }
      );
    }

    // Generate new invitation token (or reuse existing one)
    let invitationToken = user.migrationInvitationToken;
    if (!invitationToken) {
      invitationToken = randomBytes(32).toString("base64url");
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    // Create registration link
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const registrationLink = `${baseUrl}/register/migrate?token=${invitationToken}`;

    // Generate webhook data
    const webhookData: InvitationWebhookData = {
      email: user.email,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      registrationLink,
    };

    // Send via webhook
    const emailSent = await sendInvitationWebhook(webhookData);

    if (emailSent) {
      // Update user with invitation details
      await prisma.user.update({
        where: { id: user.id },
        data: {
          migrationInvitationSent: true,
          migrationInvitationSentAt:
            user.migrationInvitationSentAt || new Date(), // Keep first invitation date
          migrationLastSentAt: new Date(),
          migrationInvitationCount: { increment: 1 },
          migrationInvitationToken: invitationToken,
          migrationTokenExpiresAt: expiresAt,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Invitation resent successfully",
      });
    } else {
      return NextResponse.json(
        {
          error: "Failed to send invitation email",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Resend invitation error:", error);
    return NextResponse.json(
      { error: "Failed to resend invitation" },
      { status: 500 }
    );
  }
}
