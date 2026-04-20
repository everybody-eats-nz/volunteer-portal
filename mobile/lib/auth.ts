import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { api, ApiError } from './api';
import type { PasskeyAuthResponse } from './passkey-client';
import type { OAuthToken } from './oauth';

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
  restoreSession: () => Promise<void>;
};

async function persist(data: AuthResponse, set: (partial: Partial<AuthState>) => void) {
  await SecureStore.setItemAsync('auth_token', data.token);
  set({ user: data.user, isAuthenticated: true });
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
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await SecureStore.deleteItemAsync('auth_token');
      }
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
