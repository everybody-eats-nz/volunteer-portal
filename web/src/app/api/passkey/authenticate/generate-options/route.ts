/**
 * POST /api/passkey/authenticate/generate-options
 *
 * Generate WebAuthn authentication options for passkey login.
 * This is the first step in the passkey authentication ceremony.
 * No authentication required - this IS the login endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/types";
import { prisma } from "@/lib/prisma";
import {
  generateChallenge,
  storeChallenge,
  bufferToBase64URL,
} from "@/lib/webauthn-utils";
import { rpID, userVerification, timeout } from "@/lib/webauthn-config";

export async function POST(req: NextRequest) {
  try {
    // Parse request body (email is optional)
    const body = await req.json();
    const { email } = body as { email?: string };

    // If email provided, get user's passkeys to allow only those credentials
    let allowCredentials: Array<{
      id: string;
      type: "public-key";
      transports?: AuthenticatorTransport[];
    }> = [];

    if (email) {
      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          passkeys: {
            select: {
              credentialId: true,
              transports: true,
            },
          },
        },
      });

      if (user && user.passkeys.length > 0) {
        // Convert credential IDs to base64url
        allowCredentials = user.passkeys.map((passkey) => ({
          id: bufferToBase64URL(passkey.credentialId),
          type: "public-key" as const,
          transports: (passkey.transports as AuthenticatorTransport[]) || undefined,
        }));
      } else if (user && user.passkeys.length === 0) {
        // User exists but has no passkeys
        return NextResponse.json(
          { error: "No passkeys registered for this email" },
          { status: 404 }
        );
      } else {
        // User doesn't exist
        // Don't reveal that the email doesn't exist (privacy/security)
        // Return generic error
        return NextResponse.json(
          { error: "No passkeys found" },
          { status: 404 }
        );
      }
    }

    // Generate authentication options
    const options: PublicKeyCredentialRequestOptionsJSON = await generateAuthenticationOptions({
      rpID,
      userVerification,
      allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
      timeout,
    });

    // Store the challenge for verification
    await storeChallenge(options.challenge, "authentication", {
      email: email || undefined,
    });

    return NextResponse.json(
      { options },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error generating passkey authentication options:", error);
    return NextResponse.json(
      {
        error: "Failed to generate authentication options",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
