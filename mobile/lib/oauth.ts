import * as AppleAuthentication from 'expo-apple-authentication';
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
 * Google sign-in hook — delegates to expo-auth-session's Google provider,
 * which picks the correct flow per platform (code + PKCE with reversed-DNS
 * redirect on iOS, token exchange on Android/web). Must be called at the top
 * of a component; use the returned `promptAsync` from event handlers.
 */
export function useGoogleAuth() {
  return Google.useAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB,
    scopes: ['openid', 'profile', 'email'],
  });
}

/**
 * Facebook sign-in hook — mirrors the Google pattern. Facebook returns an
 * access token (not an id_token) which the server exchanges for a profile
 * via the Graph API. Must be called at the top of a component; use the
 * returned `promptAsync` from event handlers.
 */
export function useFacebookAuth() {
  return Facebook.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_FACEBOOK_APP_ID,
    scopes: ['public_profile', 'email'],
  });
}
