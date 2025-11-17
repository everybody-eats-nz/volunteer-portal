import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { Upload } from "lucide-react";

import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { AdminResourcesTable } from "@/components/admin-resources-table";
import { CreateResourceDialog } from "@/components/create-resource-dialog";

interface AdminResourcesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminResourcesPage({
  searchParams,
}: AdminResourcesPageProps) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/resources");
  }
  if (role !== "ADMIN") {
    redirect("/dashboard");
  }

  const params = await searchParams;

  // Get filter parameters
  const categoryFilter = Array.isArray(params.category)
    ? params.category[0]
    : params.category;
  const typeFilter = Array.isArray(params.type)
    ? params.type[0]
    : params.type;
  const publishedFilter = Array.isArray(params.published)
    ? params.published[0]
    : params.published;

  // Build where clause for filtering
  const whereClause: Prisma.ResourceWhereInput = {};

  if (categoryFilter) {
    whereClause.category = categoryFilter as Prisma.EnumResourceCategoryFilter;
  }

  if (typeFilter) {
    whereClause.type = typeFilter as Prisma.EnumResourceTypeFilter;
  }

  if (publishedFilter !== undefined && publishedFilter !== null) {
    whereClause.isPublished = publishedFilter === "true";
  }

  // Fetch resources with stats
  const [resources, totalResources, publishedResources, totalByCategory] =
    await Promise.all([
      prisma.resource.findMany({
        where: whereClause,
        include: {
          uploader: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.resource.count(),
      prisma.resource.count({ where: { isPublished: true } }),
      prisma.resource.groupBy({
        by: ["category"],
        _count: true,
      }),
    ]);

  const stats = {
    total: totalResources,
    published: publishedResources,
    draft: totalResources - publishedResources,
    byCategory: totalByCategory,
  };

  return (
    <AdminPageWrapper
      title="Resource Hub Management"
      description="Upload and manage resources for volunteers including training materials, policies, forms, and guides."
      actions={
        <CreateResourceDialog>
          <Upload className="mr-2 h-4 w-4" />
          Upload Resource
        </CreateResourceDialog>
      }
    >
      <div className="space-y-6">
        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border bg-card p-6">
            <div className="text-sm font-medium text-muted-foreground">
              Total Resources
            </div>
            <div className="mt-2 text-3xl font-bold">{stats.total}</div>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <div className="text-sm font-medium text-muted-foreground">
              Published
            </div>
            <div className="mt-2 text-3xl font-bold text-green-600">
              {stats.published}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <div className="text-sm font-medium text-muted-foreground">
              Drafts
            </div>
            <div className="mt-2 text-3xl font-bold text-yellow-600">
              {stats.draft}
            </div>
          </div>
        </div>

        {/* Resources Table */}
        <AdminResourcesTable resources={resources} />
      </div>
    </AdminPageWrapper>
  );
}
