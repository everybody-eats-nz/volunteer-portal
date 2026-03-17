import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { ResourcesSearch } from "@/components/resources-search";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ResourcesContent } from "./resources-content";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Resource Hub - Everybody Eats Volunteer Portal",
  description:
    "Access training materials, policies, forms, guides, and helpful resources for Everybody Eats volunteers. Find everything you need to make the most of your volunteer experience.",
  path: "/resources",
});

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

  // Fetch unique tags (small, fast query for the search UI)
  const allResources = await prisma.resource.findMany({
    where: { isPublished: true },
    select: { tags: true },
  });
  const uniqueTags = Array.from(
    new Set(allResources.flatMap((r) => r.tags))
  ).sort();

  return (
    <PageContainer>
      <div className="space-y-8">
        <PageHeader
          title="Resource Hub"
          description="Access training materials, policies, forms, guides, and other helpful resources for volunteers."
        />

        {/* Search and Filters - renders immediately */}
        <ResourcesSearch availableTags={uniqueTags} />

        {/* Resources content streams in */}
        <Suspense
          fallback={
            <div className="space-y-8">
              <Skeleton className="h-5 w-40" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-48 rounded-lg" />
                ))}
              </div>
            </div>
          }
        >
          <ResourcesContent
            searchQuery={searchQuery}
            categoryFilter={categoryFilter}
            typeFilter={typeFilter}
            tagsFilter={tagsFilter}
          />
        </Suspense>
      </div>
    </PageContainer>
  );
}
