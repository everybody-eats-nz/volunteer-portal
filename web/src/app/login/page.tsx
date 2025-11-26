import { getOAuthProviders } from "@/lib/auth-providers";
import LoginClient from "./login-client";

/**
 * Server Component wrapper for the login page
 * Fetches OAuth providers server-side to prevent layout shifts
 */
export default function LoginPage() {
  const providers = getOAuthProviders();

  return <LoginClient providers={providers} />;
}
