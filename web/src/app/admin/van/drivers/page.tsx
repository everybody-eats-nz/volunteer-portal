import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import {
  listDriverProfiles,
  listSelectableOrganisations,
} from "@/lib/van/drivers";
import { formatDate } from "@/lib/van/format";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { VanDriversContent, type AdminDriver } from "./drivers-content";

function displayName(user: {
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
}): string {
  if (user.name) return user.name;
  const joined = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return joined || user.email.split("@")[0];
}

export default async function VanDriversPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const [profiles, tripCounts, organisations] = await Promise.all([
    listDriverProfiles(),
    prisma.trip.groupBy({ by: ["driverId"], _count: { _all: true } }),
    listSelectableOrganisations(),
  ]);

  const counts = new Map(tripCounts.map((row) => [row.driverId, row._count._all]));
  const now = new Date();

  const drivers: AdminDriver[] = profiles.map((profile) => ({
    profileId: profile.id,
    userId: profile.userId,
    name: displayName(profile.user),
    email: profile.user.email,
    phone: profile.user.phone,
    organisationName: profile.organisation?.name ?? null,
    organisationIsInternal: profile.organisation?.isInternal ?? null,
    status: profile.status,
    statusNote: profile.statusNote,
    licenceClass: profile.licenceClass,
    licenceExpiryLabel: profile.licenceExpiry
      ? formatDate(profile.licenceExpiry)
      : null,
    // Surfaced rather than enforced: an expired licence is the office's call,
    // and a driver blocked at the van door goes back to the paper book.
    licenceExpired: profile.licenceExpiry ? profile.licenceExpiry < now : false,
    approvedByName: profile.approvedBy?.name ?? profile.approvedBy?.email ?? null,
    approvedAtLabel: profile.approvedAt ? formatDate(profile.approvedAt) : null,
    registeredAtLabel: formatDate(profile.createdAt),
    tripCount: counts.get(profile.userId) ?? 0,
  }));

  return (
    <AdminPageWrapper
      title="Van drivers"
      description="Only approved drivers can take a van out. Driving is a capability rather than a role, so approving somebody here does not change anything else about their account."
    >
      <PageContainer>
        <VanDriversContent
          drivers={drivers}
          organisations={organisations.map((org) => ({
            id: org.id,
            name: org.name,
            isInternal: org.isInternal,
          }))}
        />
      </PageContainer>
    </AdminPageWrapper>
  );
}
