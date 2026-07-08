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

/**
 * Fire-and-forget server-side event capture. PostHog's flushAt:1 means the
 * payload is sent immediately, so we don't need to await flush in normal cases.
 */
export function phCapture(args: {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}): void {
  try {
    getPostHogServer().capture({
      distinctId: args.distinctId,
      event: args.event,
      properties: args.properties,
    });
  } catch (err) {
    console.error("phCapture failed", err);
  }
}

/**
 * Stitch an anonymous distinct_id (cookie-based) onto an authenticated user
 * so subsequent events for the user roll up to the same person/funnel.
 */
export function phAlias(args: {
  distinctId: string; // canonical id (user.id)
  alias: string; // previous anonymous id (eea_phid)
}): void {
  if (!args.alias || args.alias === args.distinctId) return;
  try {
    getPostHogServer().alias({
      distinctId: args.distinctId,
      alias: args.alias,
    });
  } catch (err) {
    console.error("phAlias failed", err);
  }
}
