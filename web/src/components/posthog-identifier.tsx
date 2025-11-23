"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";
import posthog from "posthog-js";

/**
 * PostHog user identification component
 * Identifies users in PostHog when they log in to enable person tracking
 * and captures login events for analytics
 */
export function PostHogIdentifier() {
  const { data: session, status } = useSession();
  const hasTrackedLogin = useRef(false);
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    // Only run when session is loaded
    if (status === "loading") return;

    // If user is logged in, identify them in PostHog
    if (session?.user?.email) {
      const userId = (session.user as { id?: string }).id;
      const userRole = (session.user as { role?: string }).role;
      const firstName = (session.user as { firstName?: string }).firstName;
      const lastName = (session.user as { lastName?: string }).lastName;

      // Identify user with their ID (or email as fallback)
      const userIdentifier = userId || session.user.email;
      posthog.identify(userIdentifier, {
        email: session.user.email,
        name: session.user.name || undefined,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        role: userRole || undefined,
      });

      // Track login event only once per session or when user changes
      if (!hasTrackedLogin.current || lastUserId.current !== userIdentifier) {
        posthog.capture("user_logged_in", {
          user_id: userId,
          email: session.user.email,
          role: userRole,
          has_profile_image: !!session.user.image,
          login_timestamp: new Date().toISOString(),
        });
        hasTrackedLogin.current = true;
        lastUserId.current = userIdentifier;
      }
    } else {
      // User logged out - capture logout event and reset PostHog identity
      if (hasTrackedLogin.current) {
        posthog.capture("user_logged_out", {
          logout_timestamp: new Date().toISOString(),
        });
      }
      posthog.reset();
      hasTrackedLogin.current = false;
      lastUserId.current = null;
    }
  }, [session, status]);

  // This component doesn't render anything
  return null;
}
