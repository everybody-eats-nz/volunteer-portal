import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { createVerificationToken } from "@/lib/email-verification";
import { getEmailService } from "@/lib/email-service";
import { checkForBot } from "@/lib/bot-protection";
import { getBaseUrl } from "@/lib/utils";

const resendVerificationSchema = z.object({
  email: z.string().email("Invalid email address").optional(),
});

/**
 * POST /api/auth/resend-verification
 * Resend email verification for the current user or specified email
 *
 * @example
 * ```tsx
 * // For logged in user
 * const response = await fetch("/api/auth/resend-verification", {
 *   method: "POST"
 * });
 * 
 * // For specific email (public endpoint)
 * const response = await fetch("/api/auth/resend-verification", {
 *   method: "POST",
 *   headers: { "Content-Type": "application/json" },
 *   body: JSON.stringify({
 *     email: "user@example.com"
 *   })
 * });
 * ```
 */
export async function POST(req: Request) {
  try {
    // Check for bot traffic first
    const botResponse = await checkForBot("Verification email blocked due to automated activity detection.");
    if (botResponse) {
      return botResponse;
    }

    const body = await req.json();
    const validatedData = resendVerificationSchema.parse(body);
    
    let userId: string;
    let userEmail: string;
    let userName: string;

    if (validatedData.email) {
      // Public endpoint: resend for specific email
      const user = await prisma.user.findUnique({
        where: { email: validatedData.email },
        select: {
          id: true,
          email: true,
          name: true,
          firstName: true,
          emailVerified: true,
        },
      });

      if (!user) {
        // Don't reveal whether user exists for security reasons
        return NextResponse.json(
          {
            message: "If an account with this email exists, a verification email has been sent",
          },
          { status: 200 }
        );
      }

      if (user.emailVerified) {
        // Don't reveal verification status for security reasons
        // But also don't send email if already verified
        return NextResponse.json(
          {
            message: "If an account with this email exists, a verification email has been sent",
          },
          { status: 200 }
        );
      }

      userId = user.id;
      userEmail = user.email;
      userName = user.firstName || user.name || "User";
    } else {
      // Protected endpoint: resend for current session user
      const session = await getServerSession(authOptions);
      
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: "Not authenticated" },
          { status: 401 }
        );
      }

      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          email: true,
          name: true,
          firstName: true,
          emailVerified: true,
        },
      });

      if (!user) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }

      if (user.emailVerified) {
        return NextResponse.json(
          { error: "Email is already verified" },
          { status: 400 }
        );
      }

      userId = user.id;
      userEmail = user.email;
      userName = user.firstName || user.name || "User";
    }

    // Generate new verification token
    const token = await createVerificationToken(userId);

    // Send verification email
    const emailService = getEmailService();
    const verificationLink = `${getBaseUrl()}/verify-email?token=${token}`;
    
    await emailService.sendEmailVerification({
      to: userEmail,
      firstName: userName,
      verificationLink,
    });

    return NextResponse.json(
      {
        message: "If an account with this email exists, a verification email has been sent",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Resend verification error:", error);

    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      return NextResponse.json({ error: firstError.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to send verification email. Please try again." },
      { status: 500 }
    );
  }
}