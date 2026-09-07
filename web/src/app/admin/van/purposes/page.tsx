import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { VanPurposesContent } from "./purposes-content";

/**
 * Purposes are data, not a list hardcoded in a component. Adding one here
 * changes what drivers see on the next trip they start, and the order is not
 * cosmetic: whatever sits first is a one-tap trip.
 */
export default async function VanPurposesPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const [purposes, usage] = await Promise.all([
    prisma.tripPurpose.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.trip.groupBy({ by: ["purposeId"], _count: { _all: true } }),
  ]);

  const counts = new Map(
    usage
      .filter((row) => row.purposeId !== null)
      .map((row) => [row.purposeId!, row._count._all])
  );

  return (
    <AdminPageWrapper
      title="Trip purposes"
      description="The order here is the order drivers see. Put the most common run first: it is the difference between one tap and three. Retiring a purpose hides it from drivers without touching the trips already logged against it."
    >
      <PageContainer>
        <VanPurposesContent
          initial={purposes.map((purpose) => ({
            id: purpose.id,
            label: purpose.label,
            requiresNote: purpose.requiresNote,
            isActive: purpose.isActive,
            sortOrder: purpose.sortOrder,
            tripCount: counts.get(purpose.id) ?? 0,
          }))}
        />
      </PageContainer>
    </AdminPageWrapper>
  );
}
