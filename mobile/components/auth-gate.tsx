import { useState, type ReactNode } from 'react';

import { useAuth } from '@/lib/auth';
import LoginScreen from '@/app/(auth)/login';
import RegisterScreen from '@/app/(auth)/register';
import { AgreementGateScreen } from '@/components/agreement-gate-screen';

/**
 * Gates the app behind auth and the required agreements. We swap screens with
 * local state rather than router navigation — the unauthenticated tree has no
 * navigator mounted, and direct rendering avoids the redirect loops that
 * navigation would cause here.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');

  if (!isAuthenticated) {
    return mode === 'register' ? (
      <RegisterScreen onBackToLogin={() => setMode('login')} />
    ) : (
      <LoginScreen onNavigateToRegister={() => setMode('register')} />
    );
  }

  // Authenticated but hasn't accepted the agreements yet (e.g. an OAuth
  // sign-up) — make them read and accept before entering the app.
  if (user && !user.agreementsAccepted) {
    return <AgreementGateScreen />;
  }

  return <>{children}</>;
}
