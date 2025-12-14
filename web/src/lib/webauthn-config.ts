/**
 * WebAuthn Configuration
 *
 * Centralized configuration for passkey/WebAuthn authentication.
 * Based on @simplewebauthn/server requirements.
 */

/**
 * Relying Party (RP) Name - shown to users during passkey registration
 */
export const rpName = process.env.WEBAUTHN_RP_NAME || "Everybody Eats Volunteer Portal";

/**
 * Relying Party ID - must match the domain
 * For localhost: "localhost"
 * For production: "volunteer.everybodyeats.nz" (or your actual domain)
 */
export const rpID = process.env.WEBAUTHN_RP_ID || getRpIdFromUrl();

/**
 * Expected origin - the full URL where the app is hosted
 * Used for verification during authentication
 */
export const expectedOrigin = process.env.NEXTAUTH_URL || "http://localhost:3000";

/**
 * Challenge timeout in milliseconds (5 minutes)
 */
export const challengeTimeout = 5 * 60 * 1000; // 5 minutes

/**
 * User verification requirement
 * - "required": Always require biometrics/PIN
 * - "preferred": Use biometrics if available, but allow security keys without
 * - "discouraged": Don't use biometrics
 */
export const userVerification: "required" | "preferred" | "discouraged" = "preferred";

/**
 * Attestation type
 * - "none": Privacy-friendly, don't track authenticator models
 * - "direct": Get authenticator attestation (can reveal device model)
 * - "indirect": Get attestation through a trusted third party
 */
export const attestationType: "none" | "direct" | "indirect" = "none";

/**
 * Timeout for WebAuthn ceremony in milliseconds (1 minute)
 * How long the browser waits for user to complete passkey action
 */
export const timeout = 60 * 1000; // 1 minute

/**
 * Helper function to extract RP ID from NEXTAUTH_URL
 */
function getRpIdFromUrl(): string {
  const url = process.env.NEXTAUTH_URL || "http://localhost:3000";
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch (error) {
    console.error("Failed to parse NEXTAUTH_URL for RP ID:", error);
    return "localhost";
  }
}

/**
 * Get expected origins as an array (for multiple allowed origins)
 * Useful for supporting both www and non-www versions
 */
export function getExpectedOrigins(): string[] {
  const origins = [expectedOrigin];

  // If production URL is set separately, include both
  if (process.env.NODE_ENV === "production" && process.env.NEXTAUTH_URL) {
    origins.push(process.env.NEXTAUTH_URL);
  }

  return origins;
}

/**
 * Validate configuration on startup
 */
export function validateWebAuthnConfig(): void {
  if (!rpID) {
    throw new Error("WebAuthn RP ID is not configured");
  }

  if (!expectedOrigin) {
    throw new Error("WebAuthn expected origin is not configured");
  }

  if (!rpName) {
    throw new Error("WebAuthn RP name is not configured");
  }

  // Warn if using default values in production
  if (process.env.NODE_ENV === "production") {
    if (rpID === "localhost") {
      console.warn("WARNING: Using 'localhost' as RP ID in production. Set WEBAUTHN_RP_ID environment variable.");
    }
    if (!process.env.WEBAUTHN_RP_NAME) {
      console.warn("WARNING: WEBAUTHN_RP_NAME not set. Using default value.");
    }
  }
}
