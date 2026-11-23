import { Suspense } from "react";
import type { Metadata } from "next";
import { buildPageMetadata, buildOrganizationSchema } from "@/lib/seo";
import {
  captureFunnelEvent,
  FunnelEvent,
  getPhidFromCookies,
} from "@/lib/funnel";
import { HomeLanding } from "@/components/home-landing";

export const metadata: Metadata = buildPageMetadata({
  title: "Make a Difference One Plate at a Time",
  description:
    "Everybody Eats is an innovative charitable restaurant transforming rescued food into quality 3-course meals. Join hundreds of volunteers making a real difference in communities across New Zealand.",
  path: "/",
});

/**
 * Funnel entry point: first touch for the register/signup funnels.
 *
 * Reading the PostHog cookie is per-request data, so it lives in its own
 * Suspense boundary and renders nothing. That keeps the rest of the landing
 * page in the static shell: under cacheComponents a `cookies()` call in the
 * page body would block the prerender and client navigations to `/`.
 */
async function HomepageViewTracker() {
  const phid = await getPhidFromCookies();
  captureFunnelEvent({
    event: FunnelEvent.HOMEPAGE_VIEWED,
    phid,
  });
  return null;
}

export default function Home() {
  const organizationSchema = buildOrganizationSchema();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <Suspense fallback={null}>
        <HomepageViewTracker />
      </Suspense>
      <HomeLanding />
    </>
  );
}
