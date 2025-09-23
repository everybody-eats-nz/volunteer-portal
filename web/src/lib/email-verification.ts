import { randomBytes } from "crypto";
import { prisma } from "./prisma";

/**
 * Generate a secure verification token
 */
export function generateVerificationToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Get verification token expiry time (24 hours from now)
 */
export function getVerificationTokenExpiry(): Date {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + 24);
  return expiry;
}

/**
 * Create and save a verification token for a user
 */
export async function createVerificationToken(userId: string): Promise<string> {
  const token = generateVerificationToken();
  const expiresAt = getVerificationTokenExpiry();

  await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerificationToken: token,
      emailVerificationTokenExpiresAt: expiresAt,
    },
  });

  return token;
}

/**
 * Verify and consume an email verification token
 */
export async function verifyEmailToken(token: string): Promise<{ success: boolean; userId?: string; message: string }> {
  if (!token) {
    return { success: false, message: "Verification token is required" };
  }

  const user = await prisma.user.findUnique({
    where: { emailVerificationToken: token },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      emailVerificationTokenExpiresAt: true,
    },
  });

  if (!user) {
    return { success: false, message: "Invalid verification token" };
  }

  if (user.emailVerified) {
    return { success: false, message: "Email is already verified" };
  }

  if (user.emailVerificationTokenExpiresAt && user.emailVerificationTokenExpiresAt < new Date()) {
    return { success: false, message: "Verification token has expired" };
  }

  // Verify the email and clear the token
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationTokenExpiresAt: null,
    },
  });

  return { 
    success: true, 
    userId: user.id,
    message: "Email verified successfully" 
  };
}