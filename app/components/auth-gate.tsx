import type { ReactNode } from 'react';

import { useAuth } from '@/lib/auth';
import LoginScreen from '@/app/(auth)/login';

/**
 * Renders children (the app) if authenticated,
 * otherwise shows the login screen directly.
 * No navigation/redirect — avoids infinite loops.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <>{children}</>;
}
