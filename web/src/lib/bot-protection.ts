import { headers } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Bot protection via Cloudflare Turnstile.
 *
 * Clients obtain a token from the Turnstile widget (see
 * `src/components/turnstile.tsx`) and send it in the `x-turnstile-token`
 * request header. Routes call `checkForBot()` which verifies the token
 * against Cloudflare's siteverify API.
 *
 * When TURNSTILE_SECRET_KEY is not configured (local dev, e2e tests),
 * verification is skipped entirely.
 */

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export const TURNSTILE_TOKEN_HEADER = "x-turnstile-token";

export interface TurnstileVerificationResult {
  success: boolean;
  /** True when verification was skipped because no secret key is configured */
  skipped?: boolean;
  errorCodes?: string[];
}

/**
 * Verifies a Turnstile token against Cloudflare's siteverify endpoint.
 * Fails open on network errors (matching previous botid behaviour) but
 * fails closed on an explicit rejection from Cloudflare.
 */
export async function verifyTurnstileToken(
  token: string | null,
  remoteIp?: string | null
): Promise<TurnstileVerificationResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return { success: true, skipped: true };
  }

  if (!token) {
    return { success: false, errorCodes: ["missing-input-response"] };
  }

  try {
    const params = new URLSearchParams({ secret, response: token });
    if (remoteIp) {
      params.set("remoteip", remoteIp);
    }

    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });

    if (!response.ok) {
      console.warn("Turnstile siteverify returned", response.status);
      return { success: true, skipped: true };
    }

    const data = (await response.json()) as {
      success: boolean;
      "error-codes"?: string[];
    };

    return { success: data.success, errorCodes: data["error-codes"] };
  } catch (error) {
    console.warn("Turnstile verification failed:", error);
    // In case of network failure, assume not a bot to avoid blocking
    // legitimate users.
    return { success: true, skipped: true };
  }
}

/**
 * Checks the current request for a valid Turnstile token and returns an
 * error response if verification fails, null if the request may proceed.
 * @param customErrorMessage Optional custom error message for bot detection
 */
export async function checkForBot(
  customErrorMessage?: string
): Promise<NextResponse | null> {
  const requestHeaders = await headers();
  const token = requestHeaders.get(TURNSTILE_TOKEN_HEADER);
  const forwarded = requestHeaders.get("x-forwarded-for");
  const remoteIp = forwarded ? forwarded.split(",")[0].trim() : null;

  const verification = await verifyTurnstileToken(token, remoteIp);

  if (!verification.success) {
    return NextResponse.json(
      {
        error: customErrorMessage || "Bot detected. Access denied.",
        botDetection: {
          errorCodes: verification.errorCodes,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 403 }
    );
  }

  return null;
}
