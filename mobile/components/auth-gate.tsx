import { useState, type ReactNode } from 'react';

import { useAuth } from '@/lib/auth';
import LoginScreen from '@/app/(auth)/login';
import RegisterScreen from '@/app/(auth)/register';

/**
 * Renders children (the app) if authenticated, otherwise shows the auth
 * screens. We swap between login and register with local state rather than
 * router navigation — the unauthenticated tree has no navigator mounted, and
 * direct rendering avoids the redirect loops that navigation would cause here.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');

  if (!isAuthenticated) {
    return mode === 'register' ? (
      <RegisterScreen onBackToLogin={() => setMode('login')} />
    ) : (
      <LoginScreen onNavigateToRegister={() => setMode('register')} />
    );
  }

  return <>{children}</>;
}
