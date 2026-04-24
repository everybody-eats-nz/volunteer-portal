import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { api, ApiError } from './api';
import type { PasskeyAuthResponse } from './passkey-client';
import type { OAuthToken } from './oauth';
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
};

type AuthResponse = { token: string; user: User };

type AuthState = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithOAuth: (
    provider: 'apple' | 'google' | 'facebook',
    token: OAuthToken,
  ) => Promise<void>;
  loginWithPasskey: (response: PasskeyAuthResponse) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  restoreSession: () => Promise<void>;
};

async function persist(data: AuthResponse, set: (partial: Partial<AuthState>) => void) {
  await SecureStore.setItemAsync('auth_token', data.token);
  set({ user: data.user, isAuthenticated: true });
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
    await persist(data, set);
  },

  loginWithOAuth: async (provider, token) => {
    const data = await api<AuthResponse>('/api/auth/mobile/oauth', {
      method: 'POST',
      body: { provider, ...token },
    });
    await persist(data, set);
  },

  loginWithPasskey: async (response) => {
    const data = await api<AuthResponse>('/api/auth/mobile/passkey/verify', {
      method: 'POST',
      body: { authenticationResponse: response },
    });
    await persist(data, set);
  },

  logout: async () => {
    // Unregister push token before dropping the auth token — the DELETE
    // requires a Bearer so the server can scope deletion to this user.
    const pushToken = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
    if (pushToken) {
      await unregisterPushTokenFromServer(pushToken);
      await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
    }
    await SecureStore.deleteItemAsync('auth_token');
    set({ user: null, isAuthenticated: false });
  },

  deleteAccount: async () => {
    // Server-side cascade delete. If this throws, local session stays intact
    // so the user can retry (or contact support) rather than being silently
    // logged out with their data still on the server.
    await api('/api/auth/mobile/me', { method: 'DELETE' });
    await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
    await SecureStore.deleteItemAsync('auth_token');
    set({ user: null, isAuthenticated: false });
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
