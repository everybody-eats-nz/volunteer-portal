import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Prisma, ResourceCategory, ResourceType } from "@/generated/client";
import { Eye, FilePen, Library, Upload } from "lucide-react";

import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { AdminResourcesTable } from "@/components/admin-resources-table";
import { KpiTile } from "@/components/admin/kpi-tile";
import { CreateResourceDialog } from "@/components/create-resource-dialog";

function isEnumValue<T extends Record<string, string>>(
  enumObject: T,
  value: string | undefined
): value is T[keyof T] {
  return value !== undefined && Object.values(enumObject).includes(value);
}

export const metadata: Metadata = {
  title: "Resource Hub",
};

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
  const typeFilter = Array.isArray(params.type) ? params.type[0] : params.type;
  const publishedFilter = Array.isArray(params.published)
    ? params.published[0]
    : params.published;

  // Build where clause for filtering
  const whereClause: Prisma.ResourceWhereInput = {};

  // Hand-edited URLs can carry any string; Prisma throws on an unknown enum
  // value, so ignore filters that aren't one.
  if (isEnumValue(ResourceCategory, categoryFilter)) {
    whereClause.category = categoryFilter;
  }

  if (isEnumValue(ResourceType, typeFilter)) {
    whereClause.type = typeFilter;
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
          <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
          Upload Resource
        </CreateResourceDialog>
      }
    >
      <div className="space-y-6">
        {/* Stats Overview */}
        <div className="grid gap-4 sm:grid-cols-3">
          <KpiTile
            icon={<Library />}
            label="Total resources"
            value={stats.total}
            tone="forest"
            data-testid="resources-total-card"
            valueTestId="resources-total-count"
          />
          <KpiTile
            icon={<Eye />}
            label="Published"
            value={stats.published}
            tone="sun"
            data-testid="resources-published-card"
            valueTestId="resources-published-count"
          />
          <KpiTile
            icon={<FilePen />}
            label="Drafts"
            value={stats.draft}
            tone="neutral"
            data-testid="resources-drafts-card"
            valueTestId="resources-drafts-count"
          />
        </div>

        {/* Resources Table */}
        <AdminResourcesTable
          resources={resources}
          isFiltered={Boolean(categoryFilter || typeFilter || publishedFilter)}
        />
      </div>
    </AdminPageWrapper>
  );
}
