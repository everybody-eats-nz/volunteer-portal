/**
 * POST /api/passkey/authenticate/verify-authentication
 *
 * Verify the WebAuthn authentication response and return user info.
 * This is the second (final) step in the passkey authentication ceremony.
 * Called by the NextAuth passkey provider to verify the user.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  VerifiedAuthenticationResponse,
  AuthenticatorTransport,
} from "@simplewebauthn/types";
import { prisma } from "@/lib/prisma";
import { verifyAndConsumeChallenge, base64URLToBuffer } from "@/lib/webauthn-utils";
import { rpID, expectedOrigin } from "@/lib/webauthn-config";

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const body = await req.json();
    const { authenticationResponse } = body as {
      authenticationResponse: AuthenticationResponseJSON;
    };

    if (!authenticationResponse) {
      return NextResponse.json(
        { error: "Missing authentication response" },
        { status: 400 }
      );
    }

    // Decode credential ID to find the passkey
    const credentialIdBuffer = base64URLToBuffer(authenticationResponse.id);

    // Find the passkey in database
    const passkey = await prisma.passkey.findUnique({
      where: {
        credentialId: credentialIdBuffer,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            firstName: true,
            lastName: true,
            role: true,
            phone: true,
            emailVerified: true,
          },
        },
      },
    });

    if (!passkey) {
      return NextResponse.json(
        { error: "Passkey not found" },
        { status: 404 }
      );
    }

    // Extract and verify the challenge
    let extractedChallenge: string;

    try {
      const clientDataJSON = JSON.parse(
        Buffer.from(authenticationResponse.response.clientDataJSON, "base64url").toString()
      );

      extractedChallenge = clientDataJSON.challenge;

      await verifyAndConsumeChallenge(
        extractedChallenge,
        "authentication"
      );
    } catch (error) {
      console.error("Challenge verification failed:", error);
      return NextResponse.json(
        {
          error: "Invalid or expired challenge",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 400 }
      );
    }

    // Verify the authentication response
    let verification: VerifiedAuthenticationResponse;

    try {
      verification = await verifyAuthenticationResponse({
        response: authenticationResponse,
        expectedChallenge: extractedChallenge, // Use the extracted challenge string
        expectedOrigin,
        expectedRPID: rpID,
        // SimpleWebAuthn v11+ uses 'credential' instead of 'authenticator'
        credential: {
          id: new Uint8Array(passkey.credentialId),
          publicKey: new Uint8Array(passkey.credentialPublicKey),
          counter: Number(passkey.counter),
          transports: passkey.transports as AuthenticatorTransport[],
        },
      });
    } catch (error) {
      console.error("Authentication verification failed:", error);
      return NextResponse.json(
        {
          error: "Failed to verify authentication",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 400 }
      );
    }

    if (!verification.verified) {
      return NextResponse.json(
        { error: "Authentication verification failed" },
        { status: 400 }
      );
    }

    const { authenticationInfo } = verification;
    const { newCounter } = authenticationInfo;

    // Verify counter has incremented (anti-cloning protection)
    // Note: Counter value of 0 means the authenticator doesn't support counters
    // Only check counter if both old and new are non-zero
    const oldCounter = Number(passkey.counter);
    if (newCounter > 0 && oldCounter > 0 && newCounter <= oldCounter) {
      console.error(
        `Passkey counter did not increment. Old: ${oldCounter}, New: ${newCounter}. Possible cloned credential.`
      );
      return NextResponse.json(
        { error: "Invalid passkey counter. Possible security issue." },
        { status: 403 }
      );
    }

    // Update passkey counter and last used timestamp
    await prisma.passkey.update({
      where: { id: passkey.id },
      data: {
        counter: BigInt(newCounter),
        lastUsedAt: new Date(),
      },
    });

    // Return user info for NextAuth session
    return NextResponse.json(
      {
        verified: true,
        user: {
          id: passkey.user.id,
          email: passkey.user.email,
          name: passkey.user.name,
          firstName: passkey.user.firstName,
          lastName: passkey.user.lastName,
          role: passkey.user.role,
          phone: passkey.user.phone,
          emailVerified: passkey.user.emailVerified,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error verifying passkey authentication:", error);
    return NextResponse.json(
      {
        error: "Failed to verify authentication",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
