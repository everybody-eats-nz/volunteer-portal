/**
 * POST /api/passkey/register/generate-options
 *
 * Generate WebAuthn registration options for a logged-in user to add a passkey.
 * This is the first step in the passkey registration ceremony.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  generateRegistrationOptions,
  PublicKeyCredentialCreationOptionsJSON,
} from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { storeChallenge, bufferToBase64URL } from "@/lib/webauthn-utils";
import {
  rpName,
  rpID,
  userVerification,
  attestationType,
  timeout,
} from "@/lib/webauthn-config";

export async function POST() {
  try {
    // Verify user is authenticated
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized. You must be logged in to register a passkey." },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const userEmail = session.user.email || "";
    const userName = session.user.name || "User";

    // Fetch existing passkeys to exclude from registration
    // This prevents users from registering the same authenticator twice
    const existingPasskeys = await prisma.passkey.findMany({
      where: { userId },
      select: {
        credentialId: true,
      },
    });

    // Convert credential IDs to base64url for exclusion
    const excludeCredentials = existingPasskeys.map((passkey) => ({
      id: bufferToBase64URL(passkey.credentialId),
      type: "public-key" as const,
      transports: ["internal", "usb", "nfc", "ble"] as AuthenticatorTransport[],
    }));

    // Generate registration options using @simplewebauthn/server
    const options: PublicKeyCredentialCreationOptionsJSON =
      await generateRegistrationOptions({
        rpName,
        rpID,
        userID: new TextEncoder().encode(userId), // Convert string to Uint8Array
        userName: userEmail,
        userDisplayName: userName,
        attestationType,
        excludeCredentials,
        authenticatorSelection: {
          residentKey: "preferred", // Allows discoverable credentials (for autofill)
          userVerification,
          authenticatorAttachment: undefined, // Allow both platform and cross-platform authenticators
        },
        timeout,
      });

    // Store the challenge for verification
    await storeChallenge(options.challenge, "registration", {
      userId,
      email: userEmail,
    });

    // Return the options to the client
    return NextResponse.json(
      {
        options,
        email: userEmail,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error generating passkey registration options:", error);
    return NextResponse.json(
      {
        error: "Failed to generate registration options",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
