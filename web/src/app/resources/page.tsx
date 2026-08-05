import { Suspense } from "react";
import Image from "next/image";
import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";
import { ResourcesSearchServer } from "@/components/resources-search-server";
import { ResourcesContent } from "./resources-content";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Resource Hub - Everybody Eats Volunteer Portal",
  description:
    "Access training materials, policies, forms, guides, and helpful resources for Everybody Eats volunteers. Find everything you need to make the most of your volunteer experience.",
  path: "/resources",
});

/** Four-point sparkle — the marketing site's signature accent mark. */
function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 0c.6 6.5 5.5 11.4 12 12-6.5.6-11.4 5.5-12 12-.6-6.5-5.5-11.4-12-12C6.5 11.4 11.4 6.5 12 0z" />
    </svg>
  );
}

/** Mirrors the search panel layout while tags stream in from the server. */
function SearchPanelSkeleton() {
  return (
    <div className="rounded-[2rem] border border-forest-500/10 bg-card p-4 shadow-[0_24px_70px_-30px_rgb(14_42_28/0.45)] sm:p-6 dark:border-cream-50/10">
      <div className="flex flex-col gap-3 lg:flex-row">
        <Skeleton className="h-12 flex-1 rounded-full" />
        <div className="flex flex-col gap-3 sm:flex-row">
          <Skeleton className="h-12 w-full rounded-full sm:w-44" />
          <Skeleton className="h-12 w-full rounded-full sm:w-40" />
        </div>
      </div>
      <div className="mt-4 border-t border-forest-500/10 pt-4 dark:border-cream-50/10">
        <Skeleton className="h-3 w-28 rounded-full" />
        <div className="mt-3 flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-7 w-16 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Mirrors the results layout — count rule, then a grid of cream cards. */
function ResourcesGridSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Skeleton className="h-px w-8" />
        <Skeleton className="h-3.5 w-40 rounded-full" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="rounded-3xl border border-forest-500/10 bg-cream-100 p-6 sm:p-7 dark:border-cream-50/10 dark:bg-forest-800/60"
          >
            <div className="flex items-start justify-between">
              <Skeleton className="h-11 w-11 rounded-2xl" />
              <Skeleton className="h-3 w-16 rounded-full" />
            </div>
            <Skeleton className="mt-5 h-6 w-3/4 rounded-full" />
            <Skeleton className="mt-3 h-4 w-full rounded-full" />
            <Skeleton className="mt-2 h-4 w-2/3 rounded-full" />
            <div className="mt-6 flex items-center justify-between border-t border-forest-500/10 pt-4 dark:border-cream-50/10">
              <Skeleton className="h-3 w-14 rounded-full" />
              <Skeleton className="h-8 w-20 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ResourcesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ResourcesPage({
  searchParams,
}: ResourcesPageProps) {
  const params = await searchParams;

  // Get filter parameters
  const searchQuery = Array.isArray(params.search)
    ? params.search[0]
    : params.search;
  const categoryFilter = Array.isArray(params.category)
    ? params.category[0]
    : params.category;
  const typeFilter = Array.isArray(params.type) ? params.type[0] : params.type;
  const tagsFilter = Array.isArray(params.tags)
    ? params.tags
    : params.tags?.split(",");

  return (
    <PageContainer testid="resources-page">
      {/* ============ Forest spotlight hero with floating search ============ */}
      <div>
        <section
          className="grain relative overflow-hidden rounded-[2.5rem] bg-forest-700 px-6 pb-24 pt-12 text-cream-50 sm:px-12 sm:pb-28 sm:pt-16"
          data-testid="resources-hero"
        >
          {/* Warm sun glow — radial gradient rather than a blur filter, which
              escapes the rounded-corner clip on composited layers in Chromium */}
          <div
            aria-hidden
            className="absolute -right-28 -top-28 h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(closest-side,rgb(248_251_105/0.16),transparent)]"
          />
          <Image
            src="/patterns/kawakawa.avif"
            alt=""
            width={416}
            height={416}
            aria-hidden
            className="pointer-events-none absolute -bottom-12 -right-8 w-72 opacity-15 sm:w-96"
          />
          <div className="relative max-w-2xl">
            <p className="eyebrow mb-6 flex items-center gap-3 text-sun-200/90">
              <span className="inline-block h-px w-8 bg-sun-200/50" />
              Kia ora · The volunteer library
            </p>
            <h1 className="display text-4xl leading-[1.02] tracking-tight sm:text-6xl">
              Resource <em>Hub</em>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-cream-50/85 sm:text-lg">
              Access training materials, policies, forms, guides, and other
              helpful resources for volunteers — everything you need for the
              mahi ahead.
            </p>
          </div>
          <Sparkle className="absolute right-14 top-14 hidden h-8 w-8 text-sun-200/80 sm:block" />
        </section>

        {/* Search and filters — floats over the hero's bottom edge;
            tags stream in from the server */}
        <div className="relative z-10 -mt-14 px-2 sm:-mt-16 sm:px-8">
          <Suspense fallback={<SearchPanelSkeleton />}>
            <ResourcesSearchServer />
          </Suspense>
        </div>
      </div>

      {/* ============ Resource cards stream in ============ */}
      <section className="mt-10 pb-6 sm:mt-12">
        <Suspense fallback={<ResourcesGridSkeleton />}>
          <ResourcesContent
            searchQuery={searchQuery}
            categoryFilter={categoryFilter}
            typeFilter={typeFilter}
            tagsFilter={tagsFilter}
          />
        </Suspense>
      </section>
    </PageContainer>
  );
}
