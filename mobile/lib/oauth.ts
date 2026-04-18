import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as Facebook from 'expo-auth-session/providers/facebook';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

export type OAuthToken = {
  idToken?: string;
  accessToken?: string;
};

/**
 * Sign in with Apple.
 * Uses the native iOS dialog on iOS. Android users should fall back to Google/email —
 * Apple sign-in on Android needs a web flow that's not wired up here.
 */
export async function signInWithApple(): Promise<OAuthToken | null> {
  if (Platform.OS !== 'ios') {
    throw new Error('Sign in with Apple is only available on iOS.');
  }

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error('Apple did not return an identity token.');
    }

    return { idToken: credential.identityToken };
  } catch (error: unknown) {
    // User cancelled
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'ERR_REQUEST_CANCELED'
    ) {
      return null;
    }
    throw error;
  }
}

/**
 * Sign in with Google via AuthSession (PKCE, browser-based).
 * Configure the client ID(s) via app.json -> extra.
 */
export function useGoogleAuth() {
  return Google.useAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB,
  });
}

/**
 * One-shot Google sign-in. Uses a bare AuthSession flow so callers don't have
 * to wire up the hook in the component tree.
 */
export async function signInWithGoogle(): Promise<OAuthToken | null> {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS;
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB;

  const clientId =
    Platform.OS === 'ios'
      ? iosClientId
      : Platform.OS === 'android'
      ? androidClientId
      : webClientId;

  if (!clientId) {
    throw new Error('Google sign-in is not configured. Set EXPO_PUBLIC_GOOGLE_CLIENT_ID_*.');
  }

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'everybody-eats',
  });

  const request = new AuthSession.AuthRequest({
    clientId,
    scopes: ['openid', 'profile', 'email'],
    redirectUri,
    responseType: AuthSession.ResponseType.IdToken,
    usePKCE: false,
    extraParams: { nonce: Math.random().toString(36).slice(2) },
  });

  const result = await request.promptAsync({
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  });

  if (result.type !== 'success') return null;

  const idToken = (result.params as Record<string, string>).id_token;
  if (!idToken) throw new Error('Google did not return an id_token.');

  return { idToken };
}

/**
 * Sign in with Facebook via AuthSession.
 * Facebook returns an access token (not an id_token), which we verify server-side.
 */
export async function signInWithFacebook(): Promise<OAuthToken | null> {
  const clientId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
  if (!clientId) {
    throw new Error('Facebook sign-in is not configured. Set EXPO_PUBLIC_FACEBOOK_APP_ID.');
  }

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'everybody-eats',
  });

  const request = new AuthSession.AuthRequest({
    clientId,
    scopes: ['public_profile', 'email'],
    redirectUri,
    responseType: AuthSession.ResponseType.Token,
    usePKCE: false,
  });

  const result = await request.promptAsync({
    authorizationEndpoint: 'https://www.facebook.com/v18.0/dialog/oauth',
  });

  if (result.type !== 'success') return null;

  const accessToken = (result.params as Record<string, string>).access_token;
  if (!accessToken) throw new Error('Facebook did not return an access token.');

  return { accessToken };
}

// Re-export the Facebook helpers in case a component wants the hook variant.
export { Facebook, Google };
