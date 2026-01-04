/**
 * POST /api/passkey/register/verify-registration
 *
 * Verify the WebAuthn registration response and store the new passkey.
 * This is the second (final) step in the passkey registration ceremony.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  verifyRegistrationResponse,
  RegistrationResponseJSON,
  VerifiedRegistrationResponse,
} from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import {
  verifyAndConsumeChallenge,
  validateDeviceName,
  base64URLToBuffer,
} from "@/lib/webauthn-utils";
import { rpID, expectedOrigin } from "@/lib/webauthn-config";
import { checkAndUnlockAchievements } from "@/lib/achievements";

export async function POST(req: NextRequest) {
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

    // Parse request body
    const body = await req.json();
    const { registrationResponse, deviceName } = body as {
      registrationResponse: RegistrationResponseJSON;
      deviceName?: string;
    };

    if (!registrationResponse) {
      return NextResponse.json(
        { error: "Missing registration response" },
        { status: 400 }
      );
    }

    // Extract and verify the challenge
    let challengeRecord;
    let extractedChallenge: string;

    try {
      // Decode clientDataJSON to get the challenge
      const clientDataJSON = JSON.parse(
        Buffer.from(
          registrationResponse.response.clientDataJSON,
          "base64url"
        ).toString()
      );

      extractedChallenge = clientDataJSON.challenge;

      challengeRecord = await verifyAndConsumeChallenge(
        extractedChallenge,
        "registration"
      );

      // Verify this challenge belongs to this user
      if (challengeRecord.userId !== userId) {
        return NextResponse.json(
          { error: "Challenge was issued for a different user" },
          { status: 403 }
        );
      }
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

    // Verify the registration response using @simplewebauthn/server
    let verification: VerifiedRegistrationResponse;

    try {
      verification = await verifyRegistrationResponse({
        response: registrationResponse,
        expectedChallenge: extractedChallenge, // Use the extracted challenge string
        expectedOrigin,
        expectedRPID: rpID,
      });
    } catch (error) {
      console.error("Registration verification failed:", error);
      return NextResponse.json(
        {
          error: "Failed to verify registration",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 400 }
      );
    }

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { error: "Registration verification failed" },
        { status: 400 }
      );
    }

    const { registrationInfo } = verification;

    // SimpleWebAuthn v11+ changed the structure - credential data is now nested
    const { credential, aaguid } = registrationInfo;

    if (!credential || !credential.id || !credential.publicKey) {
      console.error("Missing credential data in registration info");
      return NextResponse.json(
        { error: "Invalid registration data" },
        { status: 400 }
      );
    }

    const credentialID = credential.id;
    const credentialPublicKey = credential.publicKey;
    const counter = credential.counter;

    // Convert base64url credential ID to Buffer for Prisma
    const credentialIdBuffer = base64URLToBuffer(credentialID);

    // Check if this credential is already registered (shouldn't happen due to excludeCredentials)
    const existingPasskey = await prisma.passkey.findUnique({
      where: {
        credentialId: Buffer.from(credentialIdBuffer),
      },
    });

    if (existingPasskey) {
      return NextResponse.json(
        { error: "This passkey is already registered" },
        { status: 409 }
      );
    }

    // Store the passkey in the database
    const validatedDeviceName = validateDeviceName(deviceName);

    const passkey = await prisma.passkey.create({
      data: {
        userId,
        credentialId: Buffer.from(credentialIdBuffer),
        credentialPublicKey: Buffer.from(credentialPublicKey),
        counter: BigInt(counter),
        deviceName: validatedDeviceName,
        transports: credential.transports || [],
        aaguid: aaguid || null,
      },
    });

    // Check for "Security Champion" achievement unlock
    try {
      await checkAndUnlockAchievements(userId);
    } catch (error) {
      console.error("Error checking achievements after passkey registration:", error);
    }

    return NextResponse.json(
      {
        verified: true,
        passkey: {
          id: passkey.id,
          deviceName: passkey.deviceName,
          createdAt: passkey.createdAt.toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error verifying passkey registration:", error);
    return NextResponse.json(
      {
        error: "Failed to verify registration",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
