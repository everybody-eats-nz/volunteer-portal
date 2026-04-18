/**
 * POST /api/auth/mobile/passkey/verify
 *
 * Mobile counterpart to /api/passkey/authenticate/verify-authentication.
 * Verifies the WebAuthn assertion from react-native-passkey and returns a
 * mobile JWT (not a NextAuth session).
 *
 * The challenge comes from the existing /api/passkey/authenticate/generate-options
 * endpoint — mobile hits that first, then calls this to verify.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  verifyAuthenticationResponse,
  AuthenticationResponseJSON,
  VerifiedAuthenticationResponse,
  AuthenticatorTransport,
} from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import {
  verifyAndConsumeChallenge,
  base64URLToBuffer,
  bufferToBase64URL,
} from "@/lib/webauthn-utils";
import { rpID, expectedOrigin } from "@/lib/webauthn-config";
import { signMobileToken, toMobileUser } from "@/lib/mobile-auth";

export async function POST(req: NextRequest) {
  try {
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

    const credentialIdBuffer = base64URLToBuffer(authenticationResponse.id);

    const passkey = await prisma.passkey.findUnique({
      where: { credentialId: Buffer.from(credentialIdBuffer) },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            profilePhotoUrl: true,
            profileCompleted: true,
            firstName: true,
            lastName: true,
            phone: true,
            dateOfBirth: true,
            emergencyContactName: true,
            emergencyContactPhone: true,
            volunteerAgreementAccepted: true,
            healthSafetyPolicyAccepted: true,
          },
        },
      },
    });

    if (!passkey) {
      return NextResponse.json({ error: "Passkey not found" }, { status: 404 });
    }

    // Extract + verify the challenge that's embedded in clientDataJSON
    let extractedChallenge: string;
    try {
      const clientData = JSON.parse(
        Buffer.from(
          authenticationResponse.response.clientDataJSON,
          "base64url"
        ).toString()
      );
      extractedChallenge = clientData.challenge;
      await verifyAndConsumeChallenge(extractedChallenge, "authentication");
    } catch (error) {
      console.error("Challenge verification failed (mobile):", error);
      return NextResponse.json(
        { error: "Invalid or expired challenge" },
        { status: 400 }
      );
    }

    let verification: VerifiedAuthenticationResponse;
    try {
      verification = await verifyAuthenticationResponse({
        response: authenticationResponse,
        expectedChallenge: extractedChallenge,
        expectedOrigin,
        expectedRPID: rpID,
        credential: {
          id: bufferToBase64URL(passkey.credentialId),
          publicKey: Uint8Array.from(passkey.credentialPublicKey),
          counter: Number(passkey.counter),
          transports: passkey.transports as AuthenticatorTransport[],
        },
      });
    } catch (error) {
      console.error("Authentication verification failed (mobile):", error);
      return NextResponse.json(
        { error: "Failed to verify authentication" },
        { status: 400 }
      );
    }

    if (!verification.verified) {
      return NextResponse.json(
        { error: "Authentication verification failed" },
        { status: 400 }
      );
    }

    const { newCounter } = verification.authenticationInfo;
    const oldCounter = Number(passkey.counter);
    if (newCounter > 0 && oldCounter > 0 && newCounter <= oldCounter) {
      console.error(
        `Passkey counter did not increment (mobile). Old: ${oldCounter}, New: ${newCounter}.`
      );
      return NextResponse.json(
        { error: "Invalid passkey counter" },
        { status: 403 }
      );
    }

    await prisma.passkey.update({
      where: { id: passkey.id },
      data: { counter: BigInt(newCounter), lastUsedAt: new Date() },
    });

    const token = await signMobileToken(passkey.user.id, passkey.user.email);
    return NextResponse.json({ token, user: toMobileUser(passkey.user) });
  } catch (error) {
    console.error("Mobile passkey verify error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
