/**
 * POST /api/passkey/authenticate/verify-authentication
 *
 * Verify the WebAuthn authentication response and return user info.
 * This is the second (final) step in the passkey authentication ceremony.
 *
 * Note: the NextAuth passkey provider does NOT call this over HTTP — it calls
 * `verifyPasskeyAuthentication()` directly in-process. This route remains for
 * any direct/external callers and shares the same verification core.
 */

import { NextRequest, NextResponse } from "next/server";
import { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { verifyPasskeyAuthentication } from "@/lib/passkey-auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { authenticationResponse } = body as {
      authenticationResponse: AuthenticationResponseJSON;
    };

    const result = await verifyPasskeyAuthentication(authenticationResponse);

    if (!result.verified) {
      return NextResponse.json(
        { error: result.error, ...(result.details ? { details: result.details } : {}) },
        { status: result.status }
      );
    }

    return NextResponse.json(
      { verified: true, user: result.user },
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
