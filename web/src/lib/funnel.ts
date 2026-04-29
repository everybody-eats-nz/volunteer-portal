import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { phCapture } from "@/lib/posthog-server";

export const PHID_COOKIE = "eea_phid";

/** Canonical funnel event names — keep in one place. */
export const FunnelEvent = {
  HOMEPAGE_VIEWED: "homepage_viewed",
  REGISTER_STARTED: "register_started",
  REGISTER_COMPLETED: "register_completed",
  SHIFTS_BROWSED: "shifts_browsed",
  SHIFT_SIGNUP_COMPLETED: "shift_signup_completed",
} as const;

export type FunnelEventName = (typeof FunnelEvent)[keyof typeof FunnelEvent];

/** Read the anonymous PostHog distinct_id cookie inside a server component. */
export async function getPhidFromCookies(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(PHID_COOKIE)?.value;
}

/** Read the anonymous distinct_id from an API-route NextRequest. */
export function getPhidFromRequest(req: NextRequest): string | undefined {
  return req.cookies.get(PHID_COOKIE)?.value;
}

/**
 * Capture a funnel event with the best distinct_id available — preferring an
 * authenticated user id, falling back to the cookie. No-ops if neither is set.
 */
export function captureFunnelEvent(args: {
  event: FunnelEventName;
  userId?: string | null;
  phid?: string | null;
  properties?: Record<string, unknown>;
}): void {
  const distinctId = args.userId || args.phid;
  if (!distinctId) return;
  phCapture({
    distinctId,
    event: args.event,
    properties: {
      ...(args.properties ?? {}),
      ...(args.phid ? { phid: args.phid } : {}),
      ...(args.userId ? { user_id: args.userId } : {}),
    },
  });
}
