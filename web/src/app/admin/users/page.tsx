import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { Users, UserPlus, Shield } from "lucide-react";

import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { AdminUsersSearch } from "@/components/admin-users-search";
import { InviteUserDialog } from "@/components/invite-user-dialog";
import { PageContainer } from "@/components/page-container";
import { UsersDataTable } from "@/components/users-data-table";
import { Button } from "@/components/ui/button";

interface AdminUsersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminUsersPage({
  searchParams,
}: AdminUsersPageProps) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/users");
  }
  if (role !== "ADMIN") {
    redirect("/dashboard");
  }

  const params = await searchParams;

  // Get search and filter parameters
  const searchQuery = Array.isArray(params.search)
    ? params.search[0]
    : params.search;
  const roleFilter = Array.isArray(params.role) ? params.role[0] : params.role;

  // Build where clause for filtering
  const whereClause: Prisma.UserWhereInput = {};

  if (searchQuery) {
    whereClause.OR = [
      { email: { contains: searchQuery, mode: "insensitive" } },
      { name: { contains: searchQuery, mode: "insensitive" } },
      { firstName: { contains: searchQuery, mode: "insensitive" } },
      { lastName: { contains: searchQuery, mode: "insensitive" } },
    ];
  }

  if (roleFilter && (roleFilter === "ADMIN" || roleFilter === "VOLUNTEER")) {
    whereClause.role = roleFilter;
  }

  // Fetch users with signup counts
  const [users, totalUsers, totalAdmins, totalVolunteers, newUsersThisMonth] =
    await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          email: true,
          name: true,
          firstName: true,
          lastName: true,
          phone: true,
          profilePhotoUrl: true,
          role: true,
          volunteerGrade: true,
          createdAt: true,
          _count: {
            select: {
              signups: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.user.count(),
      prisma.user.count({ where: { role: "ADMIN" } }),
      prisma.user.count({ where: { role: "VOLUNTEER" } }),
      prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
    ]);

  return (
    <AdminPageWrapper 
      title="User Management" 
      description="Manage volunteers, administrators, and invite new users to the platform."
      actions={
        <InviteUserDialog>
          <Button
            size="sm"
            className="btn-primary gap-2"
            data-testid="invite-user-button"
          >
            <UserPlus className="h-4 w-4" />
            Invite User
          </Button>
        </InviteUserDialog>
      }
    >
      <PageContainer testid="admin-users-page">

      {/* Quick Stats */}
      <section className="mb-6" data-testid="stats-section">
        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-3"
          data-testid="user-stats-grid"
        >
          <div
            className="border rounded-lg p-3 bg-white"
            data-testid="total-users-stat"
          >
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              <div>
                <div
                  className="text-lg font-semibold"
                  data-testid="total-users-count"
                >
                  {totalUsers}
                </div>
                <div className="text-xs text-muted-foreground">Total Users</div>
              </div>
            </div>
          </div>

          <div
            className="border rounded-lg p-3 bg-white"
            data-testid="volunteers-stat"
          >
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-600" />
              <div>
                <div
                  className="text-lg font-semibold"
                  data-testid="volunteers-count"
                >
                  {totalVolunteers}
                </div>
                <div className="text-xs text-muted-foreground">Volunteers</div>
              </div>
            </div>
          </div>

          <div
            className="border rounded-lg p-3 bg-white"
            data-testid="admins-stat"
          >
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-purple-600" />
              <div>
                <div
                  className="text-lg font-semibold"
                  data-testid="admins-count"
                >
                  {totalAdmins}
                </div>
                <div className="text-xs text-muted-foreground">Admins</div>
              </div>
            </div>
          </div>

          <div
            className="border rounded-lg p-3 bg-white"
            data-testid="new-users-stat"
          >
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-orange-600" />
              <div>
                <div
                  className="text-lg font-semibold"
                  data-testid="new-users-count"
                >
                  {newUsersThisMonth}
                </div>
                <div className="text-xs text-muted-foreground">
                  New This Month
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Search and Filters */}
      <AdminUsersSearch 
        initialSearch={searchQuery}
        roleFilter={roleFilter}
      />

      {/* Users DataTable */}
      <section data-testid="users-section">
        {users.length === 0 ? (
          <div className="text-center py-16" data-testid="no-users-message">
            <div className="h-20 w-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-slate-100 to-gray-100 flex items-center justify-center shadow-inner">
              <Users className="h-10 w-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">
              No users found
            </h3>
            <p className="text-slate-600 max-w-md mx-auto mb-6">
              {searchQuery || roleFilter
                ? "No users found matching your filters. Try adjusting your search or filter criteria."
                : "Get started by inviting your first user to the platform."}
            </p>
            {!searchQuery && !roleFilter && (
              <InviteUserDialog>
                <Button
                  className="btn-primary gap-2"
                  data-testid="invite-first-user-button"
                >
                  <UserPlus className="h-4 w-4" />
                  Invite First User
                </Button>
              </InviteUserDialog>
            )}
          </div>
        ) : (
          <div data-testid="users-table">
            <div data-testid="users-list">
              <UsersDataTable users={users} />
            </div>
          </div>
        )}
      </section>
      </PageContainer>
    </AdminPageWrapper>
  );
}
