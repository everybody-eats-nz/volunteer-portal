import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/client";
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

  // Get pagination parameters
  const page = params.page ? parseInt(params.page as string, 10) : 1;
  const pageSize = params.pageSize
    ? parseInt(params.pageSize as string, 10)
    : 10;
  const skip = (page - 1) * pageSize;

  // Get sorting parameters
  const sortBy = Array.isArray(params.sortBy)
    ? params.sortBy[0]
    : params.sortBy || "createdAt";
  const sortOrder = Array.isArray(params.sortOrder)
    ? params.sortOrder[0]
    : params.sortOrder || "desc";

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

  // Fetch users with completed signup counts (confirmed signups for past shifts)
  const now = new Date();

  // Check if we're sorting by signups
  const isSortingBySignups = sortBy === "signups" || sortBy === "_count.signups";

  // Define the user type based on the select query - use Prisma's inferred type
  type UserSelect = Prisma.UserGetPayload<{
    select: {
      id: true;
      email: true;
      name: true;
      firstName: true;
      lastName: true;
      phone: true;
      profilePhotoUrl: true;
      role: true;
      volunteerGrade: true;
      createdAt: true;
      _count: {
        select: {
          signups: true;
        };
      };
    };
  }>;

  let users: UserSelect[];
  let filteredCount: number;

  if (isSortingBySignups) {
    // Use raw SQL query to sort by completed signup count at database level
    // This is much more efficient than fetching all users and sorting in memory

    // Build SQL WHERE conditions with proper parameterization
    // We'll build the WHERE clause dynamically using Prisma.sql
    const orderDirection = sortOrder === "asc" ? "ASC" : "DESC";

    let whereCondition = Prisma.empty;
    let countWhereCondition = Prisma.empty;

    if (searchQuery && roleFilter && (roleFilter === "ADMIN" || roleFilter === "VOLUNTEER")) {
      // Both search and role filter
      const searchPattern = `%${searchQuery.toLowerCase()}%`;
      whereCondition = Prisma.sql`
        WHERE (LOWER(u.email) LIKE ${searchPattern}
          OR LOWER(u.name) LIKE ${searchPattern}
          OR LOWER(u."firstName") LIKE ${searchPattern}
          OR LOWER(u."lastName") LIKE ${searchPattern})
        AND u.role = ${roleFilter}::text
      `;
      countWhereCondition = Prisma.sql`
        WHERE (LOWER(u.email) LIKE ${searchPattern}
          OR LOWER(u.name) LIKE ${searchPattern}
          OR LOWER(u."firstName") LIKE ${searchPattern}
          OR LOWER(u."lastName") LIKE ${searchPattern})
        AND u.role = ${roleFilter}::text
      `;
    } else if (searchQuery) {
      // Only search filter
      const searchPattern = `%${searchQuery.toLowerCase()}%`;
      whereCondition = Prisma.sql`
        WHERE (LOWER(u.email) LIKE ${searchPattern}
          OR LOWER(u.name) LIKE ${searchPattern}
          OR LOWER(u."firstName") LIKE ${searchPattern}
          OR LOWER(u."lastName") LIKE ${searchPattern})
      `;
      countWhereCondition = Prisma.sql`
        WHERE (LOWER(u.email) LIKE ${searchPattern}
          OR LOWER(u.name) LIKE ${searchPattern}
          OR LOWER(u."firstName") LIKE ${searchPattern}
          OR LOWER(u."lastName") LIKE ${searchPattern})
      `;
    } else if (roleFilter && (roleFilter === "ADMIN" || roleFilter === "VOLUNTEER")) {
      // Only role filter
      whereCondition = Prisma.sql`WHERE u.role = ${roleFilter}::text`;
      countWhereCondition = Prisma.sql`WHERE u.role = ${roleFilter}::text`;
    }

    // Query to get user IDs sorted by completed signup count
    const userIdsWithCount = await prisma.$queryRaw<
      Array<{ id: string; signup_count: bigint }>
    >`
      SELECT
        u.id,
        COUNT(DISTINCT s.id) FILTER (
          WHERE s.status = 'CONFIRMED'
          AND sh.end < ${now}
        ) as signup_count
      FROM "User" u
      LEFT JOIN "Signup" s ON u.id = s."userId"
      LEFT JOIN "Shift" sh ON s."shiftId" = sh.id
      ${whereCondition}
      GROUP BY u.id
      ORDER BY signup_count ${Prisma.raw(orderDirection)}, u."createdAt" DESC
      LIMIT ${pageSize}
      OFFSET ${skip}
    `;

    // Get total count for pagination
    const countResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT u.id) as count
      FROM "User" u
      ${countWhereCondition}
    `;
    filteredCount = Number(countResult[0]?.count || 0);

    // Fetch full user details for the paginated IDs, maintaining order
    if (userIdsWithCount.length > 0) {
      const userIds = userIdsWithCount.map((u) => u.id);

      // Fetch users with their counts
      const usersWithDetails = await prisma.user.findMany({
        where: { id: { in: userIds } },
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
              signups: {
                where: {
                  status: "CONFIRMED",
                  shift: {
                    end: {
                      lt: now,
                    },
                  },
                },
              },
            },
          },
        },
      });

      // Create a map for quick lookup
      const userMap = new Map(usersWithDetails.map((u) => [u.id, u]));

      // Maintain the order from the SQL query
      users = userIds
        .map((id) => userMap.get(id))
        .filter((u): u is UserSelect => u !== undefined);
    } else {
      users = [];
    }
  } else {
    // Build orderBy clause for non-signup sorting
    type PrismaOrderBy = Prisma.UserOrderByWithRelationInput;
    let orderByClause: PrismaOrderBy | PrismaOrderBy[];

    const order = sortOrder === "asc" ? "asc" : "desc";

    switch (sortBy) {
      case "user":
      case "name":
        // Sort by name (firstName, then lastName), fallback to email
        orderByClause = [
          { firstName: order },
          { lastName: order },
          { email: order },
        ];
        break;
      case "createdAt":
      default:
        // Default sort by createdAt
        orderByClause = { createdAt: order };
        break;
    }

    const result = await prisma.user.findMany({
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
            signups: {
              where: {
                status: "CONFIRMED",
                shift: {
                  end: {
                    lt: now,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: orderByClause,
      skip,
      take: pageSize,
    });

    users = result;
    filteredCount = await prisma.user.count({ where: whereClause });
  }

  const [totalUsers, totalAdmins, totalVolunteers, newUsersThisMonth] =
    await Promise.all([
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

  const totalPages = Math.ceil(filteredCount / pageSize);

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
              className="border rounded-lg p-3 bg-card dark:bg-card/50 backdrop-blur-sm"
              data-testid="total-users-stat"
            >
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <div
                    className="text-lg font-semibold"
                    data-testid="total-users-count"
                  >
                    {totalUsers}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Total Users
                  </div>
                </div>
              </div>
            </div>

            <div
              className="border rounded-lg p-3 bg-card dark:bg-card/50 backdrop-blur-sm"
              data-testid="volunteers-stat"
            >
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <div
                    className="text-lg font-semibold"
                    data-testid="volunteers-count"
                  >
                    {totalVolunteers}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Volunteers
                  </div>
                </div>
              </div>
            </div>

            <div
              className="border rounded-lg p-3 bg-card dark:bg-card/50 backdrop-blur-sm"
              data-testid="admins-stat"
            >
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
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
              className="border rounded-lg p-3 bg-card dark:bg-card/50 backdrop-blur-sm"
              data-testid="new-users-stat"
            >
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-orange-600 dark:text-orange-400" />
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
        <AdminUsersSearch initialSearch={searchQuery} roleFilter={roleFilter} />

        {/* Users DataTable */}
        <section data-testid="users-section">
          {users.length === 0 ? (
            <div className="text-center py-16" data-testid="no-users-message">
              <div className="h-20 w-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-slate-100 to-gray-100 dark:from-zinc-800 dark:to-zinc-700 flex items-center justify-center shadow-inner">
                <Users className="h-10 w-10 text-slate-400 dark:text-zinc-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2">
                No users found
              </h3>
              <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto mb-6">
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
                <UsersDataTable
                  users={users}
                  currentPage={page}
                  pageSize={pageSize}
                  totalCount={filteredCount}
                  totalPages={totalPages}
                  sortBy={sortBy}
                  sortOrder={sortOrder as "asc" | "desc"}
                />
              </div>
            </div>
          )}
        </section>
      </PageContainer>
    </AdminPageWrapper>
  );
}
