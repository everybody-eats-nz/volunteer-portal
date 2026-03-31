import { PostHog } from "posthog-node";

/** Server-side PostHog client (singleton) */
let client: PostHog | null = null;

export function getPostHogServer(): PostHog {
  if (!client) {
    client = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

/** Feature flag names — keep in one place per PostHog integration rules */
export enum FeatureFlag {
  CHAT_GUIDES = "chat-guides",
}

/**
 * Check a boolean feature flag for a given user.
 * Falls back to `false` if PostHog is unavailable.
 */
export async function isFeatureEnabled(
  flag: FeatureFlag,
  distinctId: string,
): Promise<boolean> {
  try {
    const ph = getPostHogServer();
    return await ph.isFeatureEnabled(flag, distinctId) ?? false;
  } catch {
    return false;
  }
}
