"use server";

import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import bcrypt from "bcrypt";
import { campaignMonitorService } from "@/lib/services/campaign-monitor";
import { validatePassword } from "@/lib/utils/password-validation";
import { getBaseUrl } from "@/lib/utils";
import { emailMatches } from "@/lib/utils/email";

interface ForgotPasswordResult {
  success: boolean;
  message: string;
}

interface ResetPasswordResult {
  success: boolean;
  message: string;
  error?: string;
}

export async function forgotPasswordAction(
  prevState: unknown,
  formData: FormData
): Promise<ForgotPasswordResult> {
  try {
    if (!formData) {
      return {
        success: false,
        message: "Form data is required",
      };
    }

    const email = formData.get("email") as string;

    if (!email) {
      return {
        success: false,
        message: "Email is required",
      };
    }

    // Find user by email. Stored emails are mixed-case (they were saved
    // exactly as typed at registration), so the match must be
    // case-insensitive or anyone who registered with a capital letter can
    // never reset their password.
    const user = await prisma.user.findFirst({
      where: emailMatches(email),
      orderBy: { createdAt: "asc" },
    });

    // Always return success for security (don't reveal if email exists)
    // But only send email if user exists
    if (user) {
      // Generate secure reset token
      const resetToken = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Save reset token to database
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: resetToken,
          passwordResetTokenExpiresAt: expiresAt,
        },
      });

      // Send password reset email via Campaign Monitor
      const resetUrl = `${getBaseUrl()}/reset-password?token=${resetToken}`;
      
      try {
        await campaignMonitorService.sendPasswordResetEmail({
          to: user.email,
          firstName: user.firstName || user.name?.split(' ')[0] || '',
          resetUrl,
          expiryHours: 24,
        });
      } catch (emailError) {
        console.error("Failed to send password reset email:", emailError);
        // Don't fail the whole operation if email fails
        // User still has the token saved in database
      }
    }

    return {
      success: true,
      message: "If an account with that email exists, we've sent password reset instructions.",
    };
  } catch (error) {
    console.error("Forgot password error:", error);
    return {
      success: false,
      message: "An error occurred while processing your request",
    };
  }
}

export async function resetPasswordAction(
  token: string,
  prevState: unknown,
  formData: FormData
): Promise<ResetPasswordResult> {
  try {
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (!password || !confirmPassword) {
      return {
        success: false,
        message: "All fields are required",
        error: "All fields are required",
      };
    }

    if (password !== confirmPassword) {
      return {
        success: false,
        message: "Passwords do not match",
        error: "Passwords do not match",
      };
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return {
        success: false,
        message: passwordValidation.errors[0],
        error: passwordValidation.errors[0],
      };
    }

    // Find user by reset token
    const user = await prisma.user.findUnique({
      where: { passwordResetToken: token },
    });

    if (!user || !user.passwordResetTokenExpiresAt) {
      return {
        success: false,
        message: "Invalid or expired reset token",
        error: "Invalid or expired reset token",
      };
    }

    // Check if token is expired
    if (new Date() > user.passwordResetTokenExpiresAt) {
      // Clean up expired token
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: null,
          passwordResetTokenExpiresAt: null,
        },
      });

      return {
        success: false,
        message: "Reset token has expired. Please request a new password reset.",
        error: "Reset token has expired. Please request a new password reset.",
      };
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        hashedPassword,
        passwordResetToken: null,
        passwordResetTokenExpiresAt: null,
      },
    });

    return {
      success: true,
      message: "Password reset successfully. You can now sign in with your new password.",
    };
  } catch (error) {
    console.error("Reset password error:", error);
    return {
      success: false,
      message: "An error occurred while resetting your password",
      error: "An error occurred while resetting your password",
    };
  }
}
