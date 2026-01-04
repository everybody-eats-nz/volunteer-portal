import { getOAuthProviders } from "@/lib/auth-providers";
import LoginClient from "./login-client";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Sign In",
  description:
    "Sign in to your Everybody Eats volunteer account to manage shifts, track achievements, and connect with the community.",
  path: "/login",
});

/**
 * Server Component wrapper for the login page
 * Fetches OAuth providers server-side to prevent layout shifts
 */
export default function LoginPage() {
  const providers = getOAuthProviders();

  return <LoginClient providers={providers} />;
}
