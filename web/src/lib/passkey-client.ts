/**
 * Client-side Passkey Utilities
 *
 * Helper functions for WebAuthn/passkey operations in the browser.
 * Uses @simplewebauthn/browser for WebAuthn ceremonies.
 */

"use client";

import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/types";

/**
 * Check if passkeys are supported in the current browser
 */
export async function isPasskeySupported(): Promise<boolean> {
  // Check for PublicKeyCredential support
  if (!window.PublicKeyCredential) {
    return false;
  }

  // Additional check for create method
  if (typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== "function") {
    return false;
  }

  return true;
}

/**
 * Check if conditional mediation (autofill UI) is supported
 * This allows passkeys to appear in the browser's autofill dropdown
 */
export async function isConditionalMediationSupported(): Promise<boolean> {
  if (!window.PublicKeyCredential) {
    return false;
  }

  try {
    // Check if isConditionalMediationAvailable method exists
    if (typeof PublicKeyCredential.isConditionalMediationAvailable === "function") {
      return await PublicKeyCredential.isConditionalMediationAvailable();
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Check if platform authenticator is available (Face ID, Touch ID, Windows Hello)
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!window.PublicKeyCredential) {
    return false;
  }

  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Get device-specific passkey message
 * Returns user-friendly text based on the device/platform
 */
export function getPasskeyMessage(): string {
  const userAgent = navigator.userAgent;

  if (/iPhone|iPad|iPod/.test(userAgent)) {
    return "Use Face ID or Touch ID";
  } else if (/Android/.test(userAgent)) {
    return "Use fingerprint or face unlock";
  } else if (/Mac/.test(userAgent)) {
    return "Use Touch ID";
  } else if (/Windows/.test(userAgent)) {
    return "Use Windows Hello";
  } else {
    return "Use your passkey";
  }
}

/**
 * Register a new passkey for the current user
 * User must be logged in
 */
export async function registerPasskey(deviceName?: string): Promise<void> {
  try {
    // Step 1: Get registration options from server
    const optionsResponse = await fetch("/api/passkey/register/generate-options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!optionsResponse.ok) {
      const error = await optionsResponse.json();
      throw new Error(error.error || "Failed to get registration options");
    }

    const { options } = await optionsResponse.json() as {
      options: PublicKeyCredentialCreationOptionsJSON;
    };

    // Step 2: Start WebAuthn registration ceremony
    let registrationResponse: RegistrationResponseJSON;
    try {
      registrationResponse = await startRegistration(options);
    } catch (error) {
      // User canceled or error during WebAuthn ceremony
      throw new Error(getWebAuthnErrorMessage(error));
    }

    // Step 3: Send response to server for verification
    const verifyResponse = await fetch("/api/passkey/register/verify-registration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        registrationResponse,
        deviceName: deviceName || getDefaultDeviceName(),
      }),
    });

    if (!verifyResponse.ok) {
      const error = await verifyResponse.json();
      throw new Error(error.error || "Failed to verify registration");
    }

    const result = await verifyResponse.json();

    if (!result.verified) {
      throw new Error("Registration verification failed");
    }

    // Success!
  } catch (error) {
    console.error("Passkey registration error:", error);
    throw error;
  }
}

/**
 * Authenticate with a passkey
 * Returns the authentication response for NextAuth
 */
export async function authenticateWithPasskey(
  email?: string
): Promise<AuthenticationResponseJSON> {
  try {
    // Step 1: Get authentication options from server
    const optionsResponse = await fetch("/api/passkey/authenticate/generate-options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!optionsResponse.ok) {
      const error = await optionsResponse.json();
      throw new Error(error.error || "Failed to get authentication options");
    }

    const { options } = await optionsResponse.json() as {
      options: PublicKeyCredentialRequestOptionsJSON;
    };

    // Step 2: Start WebAuthn authentication ceremony
    let authenticationResponse: AuthenticationResponseJSON;
    try {
      authenticationResponse = await startAuthentication(options);
    } catch (error) {
      // User canceled or error during WebAuthn ceremony
      throw new Error(getWebAuthnErrorMessage(error));
    }

    return authenticationResponse;
  } catch (error) {
    console.error("Passkey authentication error:", error);
    throw error;
  }
}

/**
 * Start conditional authentication (autofill UI)
 * This shows passkeys in the browser's autofill dropdown
 * Should be called when the login page loads
 */
export async function startConditionalAuthentication(
  onSuccess: (authResponse: AuthenticationResponseJSON) => void,
  onError: (error: Error) => void
): Promise<AbortController | null> {
  try {
    // Check if conditional mediation is supported
    const isSupported = await isConditionalMediationSupported();
    if (!isSupported) {
      console.log("Conditional mediation not supported");
      return null;
    }

    // Get authentication options from server
    const optionsResponse = await fetch("/api/passkey/authenticate/generate-options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}), // No email filter for conditional UI
    });

    if (!optionsResponse.ok) {
      console.error("Failed to get authentication options for conditional UI");
      return null;
    }

    const { options } = await optionsResponse.json() as {
      options: PublicKeyCredentialRequestOptionsJSON;
    };

    // Create an abort controller to allow canceling the request
    const abortController = new AbortController();

    // Start authentication with conditional mediation
    // This will show passkeys in the autofill dropdown
    startAuthentication(options, true) // true enables conditional mediation
      .then((authResponse) => {
        onSuccess(authResponse);
      })
      .catch((error) => {
        // Don't report abort errors (user might have just typed in password instead)
        if (error.name !== "AbortError") {
          onError(new Error(getWebAuthnErrorMessage(error)));
        }
      });

    return abortController;
  } catch (error) {
    console.error("Error starting conditional authentication:", error);
    return null;
  }
}

/**
 * List user's registered passkeys
 */
export async function listPasskeys(): Promise<Array<{
  id: string;
  deviceName: string;
  transports: string[];
  createdAt: string;
  lastUsedAt: string | null;
}>> {
  try {
    const response = await fetch("/api/passkey/list", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch passkeys");
    }

    const { passkeys } = await response.json();
    return passkeys;
  } catch (error) {
    console.error("Error fetching passkeys:", error);
    throw error;
  }
}

/**
 * Delete a passkey
 */
export async function deletePasskey(passkeyId: string): Promise<void> {
  try {
    const response = await fetch("/api/passkey/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passkeyId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.message || "Failed to delete passkey");
    }
  } catch (error) {
    console.error("Error deleting passkey:", error);
    throw error;
  }
}

/**
 * Rename a passkey
 */
export async function renamePasskey(passkeyId: string, deviceName: string): Promise<void> {
  try {
    const response = await fetch("/api/passkey/rename", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passkeyId, deviceName }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to rename passkey");
    }
  } catch (error) {
    console.error("Error renaming passkey:", error);
    throw error;
  }
}

/**
 * Get a default device name based on user agent
 */
function getDefaultDeviceName(): string {
  const userAgent = navigator.userAgent;

  if (/iPhone/.test(userAgent)) {
    return "iPhone";
  } else if (/iPad/.test(userAgent)) {
    return "iPad";
  } else if (/Android/.test(userAgent)) {
    return "Android Device";
  } else if (/Mac/.test(userAgent)) {
    return "Mac";
  } else if (/Windows/.test(userAgent)) {
    return "Windows PC";
  } else if (/Linux/.test(userAgent)) {
    return "Linux PC";
  } else {
    return "My Device";
  }
}

/**
 * Convert WebAuthn error to user-friendly message
 */
export function getWebAuthnErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // User canceled the operation
    if (
      name.includes("notallowederror") ||
      message.includes("user cancel") ||
      message.includes("abort")
    ) {
      return "Passkey setup was canceled";
    }

    // No passkey found
    if (name.includes("notfounderror") || message.includes("not found")) {
      return "No passkey found for this account";
    }

    // Invalid state (credential already registered)
    if (name.includes("invalidstateerror")) {
      return "This passkey is already registered";
    }

    // Timeout
    if (name.includes("timeouterror") || message.includes("timeout")) {
      return "Passkey operation timed out. Please try again.";
    }

    // Not supported
    if (name.includes("notsupportederror")) {
      return "Passkeys are not supported in this browser";
    }

    // Security error
    if (name.includes("securityerror")) {
      return "Security error. Make sure you're on a secure connection (HTTPS).";
    }

    // Generic error
    return error.message || "An error occurred with your passkey";
  }

  return "An unknown error occurred";
}

/**
 * Get user-friendly error message for any passkey operation error
 */
export function getPasskeyErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Check if it's a WebAuthn-specific error
    if (error.name.includes("Error") && error.message) {
      return getWebAuthnErrorMessage(error);
    }
    return error.message;
  }

  return "An unknown error occurred";
}
