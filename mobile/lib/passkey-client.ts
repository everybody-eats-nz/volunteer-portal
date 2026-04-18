import { Passkey } from 'react-native-passkey';
import type {
  PasskeyGetRequest,
  PasskeyGetResult,
} from 'react-native-passkey/lib/typescript/PasskeyTypes';

import { api } from './api';

/** Serialized response we send to the server (shape matches WebAuthn JSON). */
export type PasskeyAuthResponse = {
  id: string;
  rawId: string;
  type: 'public-key';
  response: {
    clientDataJSON: string;
    authenticatorData: string;
    signature: string;
    userHandle?: string;
  };
  clientExtensionResults?: Record<string, unknown>;
  authenticatorAttachment?: string;
};

/**
 * Check whether passkeys are usable on this device.
 * Passkey.isSupported is synchronous — wrap in Promise for async/await symmetry.
 */
export async function isPasskeySupported(): Promise<boolean> {
  try {
    return Passkey.isSupported();
  } catch {
    return false;
  }
}

/**
 * Run the passkey sign-in ceremony:
 *   1. Ask the server for WebAuthn options
 *   2. Let the OS prompt the user to use a passkey
 *   3. Return the signed response — caller sends it back to the server
 *
 * Returns null if the user cancels.
 */
export async function signInWithPasskey(
  email?: string,
): Promise<PasskeyAuthResponse | null> {
  const { options } = await api<{ options: PasskeyGetRequest }>(
    '/api/passkey/authenticate/generate-options',
    { method: 'POST', body: email ? { email } : {} },
  );

  try {
    const result: PasskeyGetResult = await Passkey.get(options);
    return {
      id: result.id,
      rawId: result.rawId ?? result.id,
      type: 'public-key',
      response: {
        clientDataJSON: result.response.clientDataJSON,
        authenticatorData: result.response.authenticatorData,
        signature: result.response.signature,
        userHandle: result.response.userHandle,
      },
      authenticatorAttachment: result.authenticatorAttachment,
    };
  } catch (error) {
    if (isPasskeyCancellation(error)) return null;
    throw error;
  }
}

function isPasskeyCancellation(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  return /cancel|abort|not\s?allowed/i.test(message);
}
