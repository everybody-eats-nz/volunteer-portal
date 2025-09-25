import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import Link from "next/link";
import { StarIcon, PauseIcon, CalendarIcon } from "lucide-react";
import { RegularsTable } from "./regulars-table";
import { RegularVolunteerForm } from "./regular-volunteer-form";

export default async function RegularVolunteersPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session?.user) redirect("/login?callbackUrl=/admin/regulars");
  if (role !== "ADMIN") redirect("/dashboard");

  // Fetch all regular volunteers with their details
  const regulars = await prisma.regularVolunteer.findMany({
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

  // Get all volunteers for the form
  const volunteers = await prisma.user.findMany({
    where: {
      role: "VOLUNTEER",
      regularVolunteer: null, // Only show volunteers who aren't already regulars
    },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
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
      actions={
        <Button asChild variant="outline" size="sm">
          <Link href="/admin">← Back to admin</Link>
        </Button>
      }
    >
      <PageContainer testid="regular-volunteers-page">

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Regulars
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {stats.total}
              </p>
            </div>
            <StarIcon className="h-8 w-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Active
              </p>
              <p className="text-2xl font-bold text-green-600">
                {stats.active}
              </p>
            </div>
            <CalendarIcon className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Paused
              </p>
              <p className="text-2xl font-bold text-yellow-600">
                {stats.paused}
              </p>
            </div>
            <PauseIcon className="h-8 w-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Inactive
              </p>
              <p className="text-2xl font-bold text-gray-500">
                {stats.inactive}
              </p>
            </div>
            <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700" />
          </div>
        </div>
      </div>

      {/* Add Regular Form */}
      <div className="mb-8">
        <RegularVolunteerForm volunteers={volunteers} shiftTypes={shiftTypes} />
      </div>

      {/* Regulars Table */}
      <RegularsTable regulars={regulars} />
      </PageContainer>
    </AdminPageWrapper>
  );
}
