/**
 * Passkey authentication verification (in-process)
 *
 * Shared core for verifying a WebAuthn authentication assertion. Used by both
 * the HTTP route (`/api/passkey/authenticate/verify-authentication`) and the
 * NextAuth passkey provider in `auth-options.ts`.
 *
 * IMPORTANT: NextAuth's `authorize()` must call this directly — never via an
 * HTTP fetch to our own public URL. In production the server cannot reliably
 * route back to its own public hostname (hairpin NAT / proxy in front), which
 * caused passkey logins to fail with a connect timeout.
 */

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
import { unarchiveUser } from "@/lib/archive-service";
import { ArchiveTriggerSource, Role } from "@/generated/client";

export interface PasskeyAuthUser {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  role: Role;
  phone: string | null;
  emailVerified: boolean;
}

export type PasskeyAuthResult =
  | { verified: true; user: PasskeyAuthUser }
  | { verified: false; status: number; error: string; details?: string };

/**
 * Verify a WebAuthn authentication assertion and return the authenticated user.
 *
 * Performs the full ceremony: locate the passkey, verify + consume the
 * challenge, verify the assertion signature, enforce the anti-cloning counter,
 * update the counter / lastUsedAt, and auto-reactivate an archived user
 * (successful assertion is cryptographic proof of identity).
 */
export async function verifyPasskeyAuthentication(
  authenticationResponse: AuthenticationResponseJSON
): Promise<PasskeyAuthResult> {
  if (!authenticationResponse) {
    return { verified: false, status: 400, error: "Missing authentication response" };
  }

  // Decode credential ID to find the passkey
  const credentialIdBuffer = base64URLToBuffer(authenticationResponse.id);

  const passkey = await prisma.passkey.findUnique({
    where: {
      credentialId: Buffer.from(credentialIdBuffer),
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
          archivedAt: true,
        },
      },
    },
  });

  if (!passkey) {
    return { verified: false, status: 404, error: "Passkey not found" };
  }

  // Extract and verify the challenge embedded in clientDataJSON
  let extractedChallenge: string;
  try {
    const clientDataJSON = JSON.parse(
      Buffer.from(
        authenticationResponse.response.clientDataJSON,
        "base64url"
      ).toString()
    );

    extractedChallenge = clientDataJSON.challenge;

    await verifyAndConsumeChallenge(extractedChallenge, "authentication");
  } catch (error) {
    console.error("Challenge verification failed:", error);
    return {
      verified: false,
      status: 400,
      error: "Invalid or expired challenge",
      details: error instanceof Error ? error.message : "Unknown error",
    };
  }

  // Verify the authentication response
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
    console.error("Authentication verification failed:", error);
    return {
      verified: false,
      status: 400,
      error: "Failed to verify authentication",
      details: error instanceof Error ? error.message : "Unknown error",
    };
  }

  if (!verification.verified) {
    return {
      verified: false,
      status: 400,
      error: "Authentication verification failed",
    };
  }

  const { newCounter } = verification.authenticationInfo;

  // Verify counter has incremented (anti-cloning protection).
  // Counter value of 0 means the authenticator doesn't support counters —
  // only check when both old and new are non-zero.
  const oldCounter = Number(passkey.counter);
  if (newCounter > 0 && oldCounter > 0 && newCounter <= oldCounter) {
    console.error(
      `Passkey counter did not increment. Old: ${oldCounter}, New: ${newCounter}. Possible cloned credential.`
    );
    return {
      verified: false,
      status: 403,
      error: "Invalid passkey counter. Possible security issue.",
    };
  }

  // Update passkey counter and last used timestamp
  await prisma.passkey.update({
    where: { id: passkey.id },
    data: {
      counter: BigInt(newCounter),
      lastUsedAt: new Date(),
    },
  });

  // Auto-reactivate archived users — successful passkey assertion is
  // cryptographic proof of identity, same standard as OAuth re-auth.
  if (passkey.user.archivedAt) {
    await unarchiveUser({
      userId: passkey.user.id,
      triggerSource: ArchiveTriggerSource.SELF_REACTIVATION,
      actorId: passkey.user.id,
    });
  }

  return {
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
  };
}
