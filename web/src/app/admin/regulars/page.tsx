import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageContainer } from "@/components/page-container";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { KpiTile } from "@/components/admin/kpi-tile";
import {
  StarIcon,
  PauseIcon,
  CalendarIcon,
  CircleSlashIcon,
} from "lucide-react";
import { RegularsTable } from "./regulars-table";
import { RegularVolunteerForm } from "./regular-volunteer-form";
import { getActiveLocationNames, LocationOption } from "@/lib/locations";

export const metadata: Metadata = {
  title: "Regular Volunteers",
};

interface RegularVolunteersPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function RegularVolunteersPage({
  searchParams,
}: RegularVolunteersPageProps) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session?.user) redirect("/login?callbackUrl=/admin/regulars");
  if (role !== "ADMIN") redirect("/dashboard");

  const params = await searchParams;

  const LOCATIONS = await getActiveLocationNames();

  // Normalize and validate selected location
  const rawLocation = Array.isArray(params.location)
    ? params.location[0]
    : params.location;
  const selectedLocation: LocationOption | undefined = LOCATIONS.includes(
    (rawLocation as LocationOption) ?? ("" as LocationOption)
  )
    ? (rawLocation as LocationOption)
    : undefined;

  // Fetch regular volunteers with their details (filtered by location if specified)
  const regulars = await prisma.regularVolunteer.findMany({
    where: selectedLocation ? { location: selectedLocation } : undefined,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      shiftType: true,
      autoSignups: {
        take: 5,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          signup: {
            include: {
              shift: true,
            },
          },
        },
      },
      _count: {
        select: {
          autoSignups: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Every existing regular, so the form can hide shift types a person is
  // already a regular for. Deliberately not filtered by the selected location —
  // the uniqueness constraint is on (userId, shiftTypeId) regardless of where.
  // This is one small row per regular, not the whole user table.
  const existingRegularPairs = await prisma.regularVolunteer.findMany({
    select: {
      userId: true,
      shiftTypeId: true,
    },
  });

  // Get shift types for the form
  const shiftTypes = await prisma.shiftType.findMany({
    orderBy: { name: "asc" },
  });

  // Calculate stats
  const stats = {
    total: regulars.length,
    active: regulars.filter((r) => r.isActive && !r.isPausedByUser).length,
    paused: regulars.filter((r) => r.isPausedByUser).length,
    inactive: regulars.filter((r) => !r.isActive).length,
  };

  return (
    <AdminPageWrapper
      title="Regular Volunteers"
      description="Manage volunteers with recurring shift assignments"
    >
      <PageContainer testid="regular-volunteers-page">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiTile
            icon={<StarIcon />}
            label="Total regulars"
            value={stats.total}
            tone="forest"
            data-testid="regulars-total-card"
            valueTestId="regulars-total-count"
          />
          <KpiTile
            icon={<CalendarIcon />}
            label="Active"
            value={stats.active}
            tone="sun"
            data-testid="regulars-active-card"
            valueTestId="regulars-active-count"
          />
          <KpiTile
            icon={<PauseIcon />}
            label="Paused"
            value={stats.paused}
            tone="neutral"
            data-testid="regulars-paused-card"
            valueTestId="regulars-paused-count"
          />
          <KpiTile
            icon={<CircleSlashIcon />}
            label="Inactive"
            value={stats.inactive}
            tone="neutral"
            data-testid="regulars-inactive-card"
            valueTestId="regulars-inactive-count"
          />
        </div>

        {/* Add Regular Form */}
        <div className="mb-8">
          <RegularVolunteerForm
            existingRegularPairs={existingRegularPairs}
            shiftTypes={shiftTypes}
            locations={LOCATIONS}
          />
        </div>

        {/* Regulars Table */}
        <RegularsTable
          regulars={regulars}
          shiftTypes={shiftTypes}
          locations={LOCATIONS}
          selectedLocation={selectedLocation}
        />
      </PageContainer>
    </AdminPageWrapper>
  );
}
