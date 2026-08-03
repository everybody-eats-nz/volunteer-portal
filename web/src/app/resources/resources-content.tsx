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
  // Build where clause. `isPublished` is the single gate for hub visibility:
  // chat-only guides are created unpublished, while a real hub resource that is
  // also fed to the AI chat stays published and therefore visible here.
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
    <div className="space-y-5">
      {/* Results Count — editorial kicker with hairline rule */}
      <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-[0.18em] text-forest-500/80 dark:text-cream-50/60">
        <span
          className="inline-block h-px w-8 bg-forest-500/40 dark:bg-cream-50/40"
          aria-hidden
        />
        Showing {resources.length} resource{resources.length !== 1 ? "s" : ""}
      </div>

      {/* Resources Grid */}
      <ResourcesGrid resources={resources} />
    </div>
  );
}
