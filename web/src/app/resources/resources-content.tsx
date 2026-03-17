import { Prisma } from "@/generated/client";
import { prisma } from "@/lib/prisma";
import { ResourcesGrid } from "@/components/resources-grid";

interface ResourcesContentProps {
  searchQuery?: string;
  categoryFilter?: string;
  typeFilter?: string;
  tagsFilter?: string[];
}

export async function ResourcesContent({
  searchQuery,
  categoryFilter,
  typeFilter,
  tagsFilter,
}: ResourcesContentProps) {
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

  // Fetch resources
  const resources = await prisma.resource.findMany({
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
  });

  return (
    <>
      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        Showing {resources.length} resource{resources.length !== 1 ? "s" : ""}
      </div>

      {/* Resources Grid */}
      <ResourcesGrid resources={resources} />
    </>
  );
}
