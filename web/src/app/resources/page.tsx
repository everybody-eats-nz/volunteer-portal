import { FileText } from "lucide-react";
import { Prisma } from "@/generated/client";
import { prisma } from "@/lib/prisma";
import { ResourcesGrid } from "@/components/resources-grid";
import { ResourcesSearch } from "@/components/resources-search";
import { PageContainer } from "@/components/page-container";

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

  // Build where clause
  const whereClause: Prisma.ResourceWhereInput = {
    isPublished: true,
  };

  if (searchQuery) {
    whereClause.OR = [
      { title: { contains: searchQuery, mode: "insensitive" } },
      { description: { contains: searchQuery, mode: "insensitive" } },
    ];
  }

  if (categoryFilter) {
    whereClause.category = categoryFilter as Prisma.EnumResourceCategoryFilter;
  }

  if (typeFilter) {
    whereClause.type = typeFilter as Prisma.EnumResourceTypeFilter;
  }

  if (tagsFilter && tagsFilter.length > 0) {
    whereClause.tags = {
      hasSome: tagsFilter,
    };
  }

  // Fetch resources and unique tags
  const [resources, allResources] = await Promise.all([
    prisma.resource.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        category: true,
        tags: true,
        fileUrl: true,
        fileName: true,
        fileSize: true,
        url: true,
        createdAt: true,
        uploader: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    // Get all published resources to extract unique tags
    prisma.resource.findMany({
      where: { isPublished: true },
      select: { tags: true },
    }),
  ]);

  // Extract unique tags
  const uniqueTags = Array.from(
    new Set(allResources.flatMap((r) => r.tags))
  ).sort();

  return (
    <PageContainer>
      <div className="space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Resource Hub</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Access training materials, policies, forms, guides, and other
            helpful resources for volunteers.
          </p>
        </div>

        {/* Search and Filters */}
        <ResourcesSearch availableTags={uniqueTags} />

        {/* Results Count */}
        <div className="text-sm text-muted-foreground">
          Showing {resources.length} resource{resources.length !== 1 ? "s" : ""}
        </div>

        {/* Resources Grid */}
        <ResourcesGrid resources={resources} />
      </div>
    </PageContainer>
  );
}
