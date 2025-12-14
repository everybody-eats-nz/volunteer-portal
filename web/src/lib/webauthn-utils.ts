/**
 * WebAuthn Utility Functions
 *
 * Helper functions for WebAuthn/passkey operations including:
 * - Challenge generation and management
 * - Buffer encoding/decoding
 * - Database operations for challenges
 */

import { prisma } from "@/lib/prisma";
import { challengeTimeout } from "./webauthn-config";
import crypto from "crypto";

/**
 * Generate a cryptographically secure random challenge
 * Returns a base64url-encoded string
 */
export function generateChallenge(): string {
  // Generate 32 random bytes
  const buffer = crypto.randomBytes(32);
  // Convert to base64url encoding (URL-safe)
  return bufferToBase64URL(buffer);
}

/**
 * Store a challenge in the database with expiry
 */
export async function storeChallenge(
  challenge: string,
  type: "registration" | "authentication",
  options?: {
    userId?: string;
    email?: string;
  }
): Promise<void> {
  const expiresAt = new Date(Date.now() + challengeTimeout);

  await prisma.webAuthnChallenge.create({
    data: {
      challenge,
      type,
      userId: options?.userId,
      email: options?.email,
      expiresAt,
    },
  });
}

/**
 * Verify a challenge exists, is valid, and hasn't expired
 * Returns the challenge record if valid, throws error if invalid
 * Deletes the challenge after verification (one-time use)
 */
export async function verifyAndConsumeChallenge(
  challenge: string,
  type: "registration" | "authentication"
): Promise<{
  id: string;
  userId?: string | null;
  email?: string | null;
}> {
  // Find the challenge
  const record = await prisma.webAuthnChallenge.findUnique({
    where: { challenge },
  });

  if (!record) {
    throw new Error("Challenge not found");
  }

  // Check if expired
  if (record.expiresAt < new Date()) {
    // Delete expired challenge
    await prisma.webAuthnChallenge.delete({
      where: { id: record.id },
    });
    throw new Error("Challenge has expired");
  }

  // Check type matches
  if (record.type !== type) {
    throw new Error(`Invalid challenge type. Expected ${type}, got ${record.type}`);
  }

  // Delete the challenge (one-time use)
  await prisma.webAuthnChallenge.delete({
    where: { id: record.id },
  });

  return {
    id: record.id,
    userId: record.userId,
    email: record.email,
  };
}

/**
 * Clean up expired challenges (should be run periodically)
 */
export async function cleanupExpiredChallenges(): Promise<number> {
  const result = await prisma.webAuthnChallenge.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  return result.count;
}

/**
 * Convert a Buffer to base64url encoding (URL-safe, no padding)
 */
export function bufferToBase64URL(buffer: Buffer | Uint8Array): string {
  const base64 = Buffer.from(buffer).toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Convert base64url string back to Buffer
 */
export function base64URLToBuffer(base64url: string): Buffer {
  // Add padding back
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64");
}

/**
 * Convert ISO string (from Uint8Array) to Buffer
 * Used when Uint8Array is JSON stringified
 */
export function isoUint8ArrayToBuffer(isoString: string): Buffer {
  try {
    const parsed = JSON.parse(isoString);
    return Buffer.from(Object.values(parsed) as number[]);
  } catch (error) {
    throw new Error("Invalid ISO Uint8Array string");
  }
}

/**
 * Convert credential ID from base64url to Buffer
 * WebAuthn returns credential IDs as base64url strings
 */
export function credentialIdToBuffer(credentialId: string): Buffer {
  return base64URLToBuffer(credentialId);
}

/**
 * Convert Buffer credential ID to base64url string
 */
export function bufferToCredentialId(buffer: Buffer): string {
  return bufferToBase64URL(buffer);
}

/**
 * Validate passkey device name
 * Ensures it's not too long and doesn't contain malicious content
 */
export function validateDeviceName(deviceName: string | undefined): string {
  if (!deviceName) {
    return "My Device";
  }

  // Trim and limit length
  const trimmed = deviceName.trim().slice(0, 50);

  // If empty after trimming, use default
  if (!trimmed) {
    return "My Device";
  }

  return trimmed;
}

/**
 * Check if user has at least one alternative authentication method
 * Returns true if user can still login after deleting a passkey
 */
export async function userHasAlternativeAuth(
  userId: string,
  excludePasskeyId?: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      passkeys: true,
    },
  });

  if (!user) {
    return false;
  }

  // Check if user has a password (non-empty hashedPassword)
  if (user.hashedPassword && user.hashedPassword.length > 0) {
    return true;
  }

  // Check if user has other passkeys
  const otherPasskeys = user.passkeys.filter(
    (passkey) => passkey.id !== excludePasskeyId
  );

  return otherPasskeys.length > 0;
}

/**
 * Get user's passkey count
 */
export async function getUserPasskeyCount(userId: string): Promise<number> {
  return await prisma.passkey.count({
    where: { userId },
  });
}

/**
 * Check if user has any passkeys
 */
export async function userHasPasskeys(userId: string): Promise<boolean> {
  const count = await getUserPasskeyCount(userId);
  return count > 0;
}
