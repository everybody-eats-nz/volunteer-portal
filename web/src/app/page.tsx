import type { Metadata } from "next";
import { buildPageMetadata, buildOrganizationSchema } from "@/lib/seo";
import {
  FeatureFlag,
  getFlagVariant,
  type HomepageVariant,
} from "@/lib/posthog-server";
import { captureFunnelEvent, FunnelEvent, getPhidFromCookies } from "@/lib/funnel";
import { HomeControl } from "@/components/home-control";
import { HomeDashboard } from "@/components/home-dashboard";

export const metadata: Metadata = buildPageMetadata({
  title: "Make a Difference One Plate at a Time",
  description:
    "Everybody Eats is an innovative charitable restaurant transforming rescued food into quality 3-course meals. Join hundreds of volunteers making a real difference in communities across New Zealand.",
  path: "/",
});

const VALID_VARIANTS: HomepageVariant[] = ["control", "dashboard"];

function isValidVariant(value: unknown): value is HomepageVariant {
  return typeof value === "string" && VALID_VARIANTS.includes(value as HomepageVariant);
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const organizationSchema = buildOrganizationSchema();
  const params = await searchParams;
  const phid = await getPhidFromCookies();

  // QA override — `?variant=control` or `?variant=dashboard` forces a variant
  // for screenshot testing without needing a flag toggle.
  const overrideRaw = Array.isArray(params.variant)
    ? params.variant[0]
    : params.variant;
  const override = isValidVariant(overrideRaw) ? overrideRaw : undefined;

  const variant: HomepageVariant =
    override ??
    (phid
      ? await getFlagVariant<HomepageVariant>(
          FeatureFlag.HOMEPAGE_REDESIGN,
          phid,
          "control"
        )
      : "control");

  // Funnel exposure event — counted as the entry point of the experiment.
  captureFunnelEvent({
    event: FunnelEvent.HOMEPAGE_VIEWED,
    phid,
    properties: {
      variant,
      override: !!override,
    },
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      {variant === "dashboard" ? <HomeDashboard /> : <HomeControl />}
    </>
  );
}
