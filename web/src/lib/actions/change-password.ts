"use server";

import bcrypt from "bcrypt";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { validatePassword } from "@/lib/utils/password-validation";

export type ChangePasswordField =
  | "currentPassword"
  | "newPassword"
  | "confirmPassword";

export interface ChangePasswordResult {
  success: boolean;
  message: string;
  /** Which field the error belongs to, so the form can show it inline. */
  field?: ChangePasswordField;
}

/**
 * Change (or, for accounts created through Google/Apple sign-in that have no
 * password yet, set) the signed-in user's password.
 *
 * Accounts with an existing password must prove they know it. Accounts
 * without one only need a valid session: they are already signed in through
 * a provider that verified their identity, and this is the only way for them
 * to gain a password without going through the forgot-password email loop.
 */
export async function changePasswordAction(
  prevState: unknown,
  formData: FormData
): Promise<ChangePasswordResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return {
      success: false,
      message: "Your session has expired. Please sign in again.",
    };
  }

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!newPassword) {
    return {
      success: false,
      message: "Please enter a new password.",
      field: "newPassword",
    };
  }

  const validation = validatePassword(newPassword);
  if (!validation.isValid) {
    return {
      success: false,
      message: `Your new password needs: ${validation.errors
        .map((e) => e.toLowerCase())
        .join(", ")}.`,
      field: "newPassword",
    };
  }

  if (newPassword !== confirmPassword) {
    return {
      success: false,
      message: "The passwords you entered don't match.",
      field: "confirmPassword",
    };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, hashedPassword: true },
    });
    if (!user) {
      return {
        success: false,
        message: "We couldn't find your account. Please sign in again.",
      };
    }

    const hasPassword = user.hashedPassword.length > 0;
    if (hasPassword) {
      if (!currentPassword) {
        return {
          success: false,
          message: "Please enter your current password.",
          field: "currentPassword",
        };
      }
      const matches = await bcrypt.compare(currentPassword, user.hashedPassword);
      if (!matches) {
        return {
          success: false,
          message: "That doesn't match your current password.",
          field: "currentPassword",
        };
      }
      if (currentPassword === newPassword) {
        return {
          success: false,
          message: "Your new password needs to be different from your current one.",
          field: "newPassword",
        };
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        hashedPassword,
        // Any outstanding reset link is now moot.
        passwordResetToken: null,
        passwordResetTokenExpiresAt: null,
      },
    });

    return {
      success: true,
      message: hasPassword
        ? "Your password has been changed."
        : "Your password is set. You can now sign in with your email and password too.",
    };
  } catch (error) {
    console.error("Change password error:", error);
    return {
      success: false,
      message: "Something went wrong while saving your password. Please try again.",
    };
  }
}
