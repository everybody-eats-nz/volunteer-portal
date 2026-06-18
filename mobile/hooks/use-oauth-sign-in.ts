import { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";

import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { signInWithApple, useGoogleAuth } from "@/lib/oauth";
import { posthog } from "@/lib/posthog";

export type OAuthProvider = "apple" | "google";

/**
 * Shared Apple/Google sign-in logic. OAuth sign-in doubles as sign-up — the
 * backend upserts the account on first auth — so the register screen uses this
 * the same way the login screen does. New accounts then pass through the
 * agreement gate (see AuthGate) before entering the app.
 */
export function useOAuthSignIn() {
  const { loginWithOAuth } = useAuth();
  const [busyProvider, setBusyProvider] = useState<OAuthProvider | null>(null);
  const [googleRequest, googleResponse, promptGoogle] = useGoogleAuth();
  // On native the Google provider exchanges the auth code for tokens in a
  // post-prompt effect, so `promptAsync` resolves before the id_token lands.
  // This ref tracks an in-flight sign-in so the effect below can finish it.
  const googleInFlight = useRef(false);

  useEffect(() => {
    if (!googleResponse || !googleInFlight.current) return;

    if (googleResponse.type !== "success") {
      googleInFlight.current = false;
      setBusyProvider(null);
      return;
    }

    const idToken =
      googleResponse.authentication?.idToken ??
      (googleResponse.params as Record<string, string>)?.id_token;

    // First fire has params.code only; wait for the post-exchange update.
    if (!idToken) return;

    googleInFlight.current = false;

    (async () => {
      try {
        await loginWithOAuth("google", { idToken });
      } catch (error) {
        handleError(error, "Couldn't sign in with Google. Please try again.");
        posthog?.capture("login_failed", { method: "oauth_google" });
      } finally {
        setBusyProvider(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleResponse]);

  function handleError(error: unknown, fallback: string) {
    const message = error instanceof ApiError ? error.message : fallback;
    Alert.alert("Sign in failed", message);
  }

  async function handleGoogle() {
    if (busyProvider) return;
    if (!googleRequest) {
      Alert.alert(
        "Sign in failed",
        "Google sign-in isn't ready yet — try again in a moment."
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusyProvider("google");
    googleInFlight.current = true;
    try {
      // Completion happens in the effect watching googleResponse — on native
      // the id_token only arrives after a post-prompt code exchange.
      await promptGoogle();
    } catch (error) {
      googleInFlight.current = false;
      handleError(error, "Couldn't sign in with Google. Please try again.");
      posthog?.capture("login_failed", { method: "oauth_google" });
      setBusyProvider(null);
    }
  }

  async function handleApple() {
    if (busyProvider) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusyProvider("apple");
    try {
      const token = await signInWithApple();
      if (!token) return; // cancelled
      await loginWithOAuth("apple", token);
    } catch (error) {
      handleError(error, "Couldn't sign in with Apple. Please try again.");
      posthog?.capture("login_failed", { method: "oauth_apple" });
    } finally {
      setBusyProvider(null);
    }
  }

  return {
    busyProvider,
    googleReady: !!googleRequest,
    handleGoogle,
    handleApple,
  };
}
