import * as SecureStore from 'expo-secure-store';
import { InteractionManager } from 'react-native';
import { create } from 'zustand';

import { api, ApiError } from './api';
import type { PasskeyAuthResponse } from './passkey-client';
import type { OAuthToken } from './oauth';
import { posthog } from './posthog';
import {
  syncPushTokenWithServer,
  unregisterPushTokenFromServer,
} from './push-notifications';

const PUSH_TOKEN_KEY = 'push_token';

export type User = {
  id: string;
  name: string;
  email: string;
  role: 'VOLUNTEER' | 'ADMIN';
  image?: string | null;
  profileComplete: boolean;
  /** True once both required agreements are accepted; gates app entry. */
  agreementsAccepted: boolean;
};

type AuthResponse = { token: string; user: User };

// 'oauth_facebook' omitted — Facebook login is disabled (broken integration).
type LoginMethod = 'email' | 'oauth_apple' | 'oauth_google' | 'passkey';

export type RegisterInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone?: string;
  volunteerAgreementAccepted: boolean;
  healthSafetyPolicyAccepted: boolean;
};

function identifyInPostHog(user: User) {
  posthog?.identify(user.id, {
    email: user.email,
    name: user.name,
    role: user.role,
  });
}

/** Comfortably outlasts UIAlertController's dismissal animation (~0.3-0.4s). */
const ALERT_DISMISSAL_SETTLE_MS = 450;

/**
 * Wait until it's safe to swap the app's UI tree after a confirm dialog.
 *
 * Flipping `isAuthenticated` unmounts the entire navigator (AuthGate swaps it
 * for the login screen). Doing that while the native sign-out alert is still
 * animating away intermittently hard-crashes iOS (Fabric unmount race).
 * InteractionManager doesn't track UIAlertController's dismissal, so we also
 * wait a fixed beat that comfortably outlasts it.
 */
async function settleUiBeforeTreeSwap(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ALERT_DISMISSAL_SETTLE_MS));
  await new Promise((resolve) => {
    InteractionManager.runAfterInteractions(() => resolve(undefined));
  });
}

type AuthState = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (input: RegisterInput) => Promise<void>;
  loginWithOAuth: (
    provider: 'apple' | 'google',
    token: OAuthToken,
  ) => Promise<void>;
  loginWithPasskey: (response: PasskeyAuthResponse) => Promise<void>;
  acceptAgreements: () => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  restoreSession: () => Promise<void>;
};

async function persist(
  data: AuthResponse,
  set: (partial: Partial<AuthState>) => void,
  method: LoginMethod,
) {
  await SecureStore.setItemAsync('auth_token', data.token);
  set({ user: data.user, isAuthenticated: true });
  identifyInPostHog(data.user);
  posthog?.capture('user_logged_in', {
    user_id: data.user.id,
    email: data.user.email,
    role: data.user.role,
    method,
    platform: 'mobile',
    has_profile_image: !!data.user.image,
    login_timestamp: new Date().toISOString(),
  });
  // Register for push after auth so the POST carries a valid Bearer token.
  // Fire-and-forget — permission prompts/network hiccups shouldn't block login.
  void syncPushTokenWithServer().then(async (pushToken) => {
    if (pushToken) {
      await SecureStore.setItemAsync(PUSH_TOKEN_KEY, pushToken);
    }
  });
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  loginWithEmail: async (email, password) => {
    const data = await api<AuthResponse>('/api/auth/mobile/login', {
      method: 'POST',
      body: { email, password },
    });
    await persist(data, set, 'email');
  },

  registerWithEmail: async (input) => {
    // Dedicated mobile endpoint: it skips the web's Turnstile gate (the app
    // can't produce a token) and returns a session token directly, so there's
    // no second login round-trip. A verification email is still sent; mobile
    // login doesn't block on it.
    const data = await api<AuthResponse>('/api/auth/mobile/register', {
      method: 'POST',
      body: {
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email: input.email.trim(),
        password: input.password,
        confirmPassword: input.confirmPassword,
        phone: input.phone?.trim() || undefined,
        volunteerAgreementAccepted: input.volunteerAgreementAccepted,
        healthSafetyPolicyAccepted: input.healthSafetyPolicyAccepted,
        // Mirror the web default — opt the volunteer into the newsletter.
        emailNewsletterSubscription: true,
      },
    });
    posthog?.capture('user_registered', {
      platform: 'mobile',
      method: 'email',
      timestamp: new Date().toISOString(),
    });
    await persist(data, set, 'email');
  },

  loginWithOAuth: async (provider, token) => {
    const data = await api<AuthResponse>('/api/auth/mobile/oauth', {
      method: 'POST',
      body: { provider, ...token },
    });
    await persist(data, set, `oauth_${provider}` as LoginMethod);
  },

  loginWithPasskey: async (response) => {
    const data = await api<AuthResponse>('/api/auth/mobile/passkey/verify', {
      method: 'POST',
      body: { authenticationResponse: response },
    });
    await persist(data, set, 'passkey');
  },

  acceptAgreements: async () => {
    const { user } = await api<{ user: User }>(
      '/api/auth/mobile/agreements',
      { method: 'POST' }
    );
    set({ user });
    posthog?.capture('agreements_accepted', {
      platform: 'mobile',
      user_id: user.id,
      timestamp: new Date().toISOString(),
    });
  },

  logout: async () => {
    try {
      // Unregister push token before dropping the auth token — the DELETE
      // requires a Bearer so the server can scope deletion to this user.
      const pushToken = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
      if (pushToken) {
        await unregisterPushTokenFromServer(pushToken);
        await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
      }
      await SecureStore.deleteItemAsync('auth_token');
    } catch (error) {
      // Best-effort cleanup - a keychain/network hiccup must never strand
      // the user in a half-signed-out state. Stale server push tokens get
      // pruned when Expo reports them as DeviceNotRegistered.
      console.warn('[auth] Sign-out cleanup failed:', error);
      posthog?.capture('logout_cleanup_failed', { error: String(error) });
    }
    await settleUiBeforeTreeSwap();
    set({ user: null, isAuthenticated: false });
    posthog?.capture('user_logged_out', {
      platform: 'mobile',
      logout_timestamp: new Date().toISOString(),
    });
    posthog?.reset();
  },

  deleteAccount: async () => {
    // Server-side cascade delete. If this throws, local session stays intact
    // so the user can retry (or contact support) rather than being silently
    // logged out with their data still on the server.
    await api('/api/auth/mobile/me', { method: 'DELETE' });
    try {
      await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
      await SecureStore.deleteItemAsync('auth_token');
    } catch (error) {
      // Account is gone server-side; a failed keychain delete must not keep
      // the user "signed in" to a dead account.
      console.warn('[auth] Post-deletion cleanup failed:', error);
      posthog?.capture('delete_account_cleanup_failed', {
        error: String(error),
      });
    }
    await settleUiBeforeTreeSwap();
    set({ user: null, isAuthenticated: false });
    posthog?.capture('user_account_deleted', {
      platform: 'mobile',
      timestamp: new Date().toISOString(),
    });
    posthog?.reset();
  },

  restoreSession: async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      if (!token) {
        set({ isLoading: false });
        return;
      }

      const user = await api<User>('/api/auth/mobile/me');
      set({ user, isAuthenticated: true, isLoading: false });
      // Re-identify on cold start so the event stream is attached to the
      // right person without emitting a fresh login event.
      identifyInPostHog(user);
      // Refresh the push token on every app start — the Expo token can
      // rotate, and we want the server's copy to stay current.
      void syncPushTokenWithServer().then(async (pushToken) => {
        if (pushToken) {
          await SecureStore.setItemAsync(PUSH_TOKEN_KEY, pushToken);
        }
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await SecureStore.deleteItemAsync('auth_token');
      }
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
