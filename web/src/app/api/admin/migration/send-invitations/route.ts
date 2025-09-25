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
    console.log(`📧 Sent migration invitation email to: ${data.email}`);
    return true;
  } catch (error) {
    console.error("Error sending migration invitation email:", error);
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
            type: "migration_invitation",
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

    const { userIds } = await request.json();

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: "No users selected" }, { status: 400 });
    }

    // Get users to send invitations to
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds },
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
      },
    });

    if (users.length === 0) {
      return NextResponse.json(
        { error: "No valid users found" },
        { status: 400 }
      );
    }

    let sentCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    const invitations: Array<{
      email: string;
      firstName: string;
      lastName: string;
      registrationUrl: string;
      success: boolean;
    }> = [];

    for (const user of users) {
      try {
        // Generate invitation token (URL-safe)
        const invitationToken = randomBytes(32).toString("base64url");
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

          sentCount++;

          // Add to invitations array for response
          invitations.push({
            email: user.email,
            firstName: user.firstName || "",
            lastName: user.lastName || "",
            registrationUrl: registrationLink,
            success: true,
          });
        } else {
          failedCount++;
          errors.push(`Failed to send email to ${user.email}`);

          // Add failed invitation to array
          invitations.push({
            email: user.email,
            firstName: user.firstName || "",
            lastName: user.lastName || "",
            registrationUrl: registrationLink,
            success: false,
          });
        }
      } catch (error) {
        failedCount++;
        errors.push(
          `Error processing ${user.email}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );

        // Add failed invitation to array
        invitations.push({
          email: user.email,
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          registrationUrl: "",
          success: false,
        });
      }
    }

    return NextResponse.json({
      sent: sentCount,
      failed: failedCount,
      errors: errors.length > 0 ? errors : undefined,
      invitations,
      message: `Successfully sent ${sentCount} invitation${
        sentCount !== 1 ? "s" : ""
      }${failedCount > 0 ? `, ${failedCount} failed` : ""}`,
    });
  } catch (error) {
    console.error("Send invitations error:", error);
    return NextResponse.json(
      { error: "Failed to send invitations" },
      { status: 500 }
    );
  }
}
