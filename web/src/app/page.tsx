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

export default async function Home() {
  const organizationSchema = buildOrganizationSchema();
  const phid = await getPhidFromCookies();

  // Funnel entry point — first touch for the register/signup funnels.
  captureFunnelEvent({
    event: FunnelEvent.HOMEPAGE_VIEWED,
    phid,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <HomeLanding />
    </>
  );
}
