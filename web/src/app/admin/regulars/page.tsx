import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import Link from "next/link";
import {
  StarIcon,
  PauseIcon,
  CalendarIcon,
  CircleSlashIcon,
} from "lucide-react";
import { RegularsTable } from "./regulars-table";
import { RegularVolunteerForm } from "./regular-volunteer-form";
import { getActiveLocationNames, LocationOption } from "@/lib/locations";

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

  const statCards = [
    {
      label: "Total Regulars",
      value: stats.total,
      icon: StarIcon,
      iconClass:
        "bg-yellow-100 text-yellow-600 dark:bg-yellow-500/15 dark:text-yellow-400",
    },
    {
      label: "Active",
      value: stats.active,
      icon: CalendarIcon,
      iconClass:
        "bg-green-100 text-green-600 dark:bg-green-500/15 dark:text-green-400",
    },
    {
      label: "Paused",
      value: stats.paused,
      icon: PauseIcon,
      iconClass:
        "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
    },
    {
      label: "Inactive",
      value: stats.inactive,
      icon: CircleSlashIcon,
      iconClass:
        "bg-zinc-100 text-zinc-500 dark:bg-zinc-500/15 dark:text-zinc-400",
    },
  ];

  return (
    <AdminPageWrapper
      title="Regular Volunteers"
      description="Manage volunteers with recurring shift assignments"
      actions={
        <Button asChild variant="outline" size="sm">
          <Link href="/admin">← Back to admin</Link>
        </Button>
      }
    >
      <PageContainer testid="regular-volunteers-page">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map(({ label, value, icon: Icon, iconClass }) => (
            <div
              key={label}
              className="bg-card dark:bg-card/50 backdrop-blur-sm p-5 rounded-lg shadow-sm border dark:border-zinc-800"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-muted-foreground truncate">
                    {label}
                  </p>
                  <p className="text-2xl font-bold text-foreground tabular-nums">
                    {value}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full p-2 ${iconClass}`}
                  aria-hidden="true"
                >
                  <Icon className="h-5 w-5" />
                </span>
              </div>
            </div>
          ))}
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
