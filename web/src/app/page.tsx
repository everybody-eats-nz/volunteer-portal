import { Suspense } from "react";
import type { Metadata } from "next";
import { buildPageMetadata, buildOrganizationSchema } from "@/lib/seo";
import { HomeLanding } from "@/components/home-landing";
import { HomepageViewTracker } from "@/components/homepage-view-tracker";

export const metadata: Metadata = buildPageMetadata({
  title: "Make a Difference One Plate at a Time",
  description:
    "Everybody Eats is an innovative charitable restaurant transforming rescued food into quality 3-course meals. Join hundreds of volunteers making a real difference in communities across New Zealand.",
  path: "/",
});

export default function Home() {
  const organizationSchema = buildOrganizationSchema();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      {/* Per-request funnel tracking (reads cookies) stays out of the
          static shell. */}
      <Suspense fallback={null}>
        <HomepageViewTracker />
      </Suspense>
      <HomeLanding />
    </>
  );
}
