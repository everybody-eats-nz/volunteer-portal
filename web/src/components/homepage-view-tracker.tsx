import {
  captureFunnelEvent,
  FunnelEvent,
  getPhidFromCookies,
} from "@/lib/funnel";

/**
 * Funnel entry point: first touch for the register/signup funnels.
 *
 * Reading the PostHog cookie is per-request data, so render this inside its
 * own `<Suspense>` boundary. It renders nothing, which keeps the rest of the
 * landing page in the static shell: under cacheComponents a `cookies()` call
 * in the page body would block the prerender and client navigations to `/`.
 */
export async function HomepageViewTracker() {
  const phid = await getPhidFromCookies();
  captureFunnelEvent({
    event: FunnelEvent.HOMEPAGE_VIEWED,
    phid,
  });
  return null;
}
