import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { api, ApiError } from './api';

export type User = {
  id: string;
  name: string;
  email: string;
  role: 'VOLUNTEER' | 'ADMIN';
  image?: string | null;
  profileComplete: boolean;
};

type AuthState = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
};

export const useAuth = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email: string, password: string) => {
    const data = await api<{ token: string; user: User }>(
      '/api/auth/mobile/login',
      {
        method: 'POST',
        body: { email, password },
      },
    );

    await SecureStore.setItemAsync('auth_token', data.token);
    set({ user: data.user, isAuthenticated: true });
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
      // Token expired or invalid — clear it
      if (error instanceof ApiError && error.status === 401) {
        await SecureStore.deleteItemAsync('auth_token');
      }
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
