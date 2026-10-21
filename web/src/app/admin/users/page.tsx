import type { Metadata } from "next";
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
import { KpiTile } from "@/components/admin/kpi-tile";
import { EmptyState } from "@/components/admin/empty-state";
import { inVolunteerProgramme } from "@/lib/volunteer-programme";
import { UsersDataTable } from "@/components/users-data-table";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "All Users",
};

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
  const locationFilter = Array.isArray(params.location)
    ? params.location[0]
    : params.location;
  const locationScopeRaw = Array.isArray(params.locationScope)
    ? params.locationScope[0]
    : params.locationScope;
  // "all" matches a user's default location OR any of their selected
  // (available) locations; "default" restricts to the default location only.
  const locationScope: "all" | "default" =
    locationScopeRaw === "default" ? "default" : "all";
  const archivedFilterRaw = Array.isArray(params.archived)
    ? params.archived[0]
    : params.archived;
  const archivedFilter: "active" | "archived" | "all" =
    archivedFilterRaw === "only"
      ? "archived"
      : archivedFilterRaw === "all"
        ? "all"
        : "active";

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

  if (locationFilter) {
    if (locationScope === "default") {
      whereClause.defaultLocation = locationFilter;
    } else {
      // availableLocations is a JSON-stringified array ('["Wellington"]'),
      // with some legacy rows holding plain text ("Wellington"), so match the
      // quoted JSON entry or the exact legacy value (see announcement-targeting).
      whereClause.AND = [
        {
          OR: [
            { defaultLocation: locationFilter },
            { availableLocations: { contains: `"${locationFilter}"` } },
            { availableLocations: locationFilter },
          ],
        },
      ];
    }
  }

  if (archivedFilter === "active") {
    whereClause.archivedAt = null;
  } else if (archivedFilter === "archived") {
    whereClause.archivedAt = { not: null };
  }
  // "all" -> no filter

  // The location list and the header stat cards don't depend on the search or
  // filter state. Wrapping them in Promise.all here subscribes to each query
  // immediately (a bare PrismaPromise is lazy and wouldn't start until awaited),
  // so all six run concurrently with the heavier filtered list query below.
  const headerDataPromise = Promise.all([
    prisma.location.findMany({
      where: { isActive: true },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.count({ where: { archivedAt: null } }),
    prisma.user.count({ where: { role: "ADMIN", archivedAt: null } }),
    // Same definition as the dashboard: external van drivers have a login
    // but aren't in the volunteer programme.
    prisma.user.count({
      where: { role: "VOLUNTEER", archivedAt: null, ...inVolunteerProgramme },
    }),
    prisma.user.count({
      where: {
        archivedAt: null,
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    }),
    prisma.user.count({ where: { archivedAt: { not: null } } }),
  ]);

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
      completedShiftAdjustment: true;
      createdAt: true;
      archivedAt: true;
      archiveReason: true;
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

    // Build individual condition fragments
    const conditions: ReturnType<typeof Prisma.sql>[] = [];

    if (searchQuery) {
      const searchPattern = `%${searchQuery.toLowerCase()}%`;
      conditions.push(Prisma.sql`
        (LOWER(u.email) LIKE ${searchPattern}
          OR LOWER(u.name) LIKE ${searchPattern}
          OR LOWER(u."firstName") LIKE ${searchPattern}
          OR LOWER(u."lastName") LIKE ${searchPattern})
      `);
    }

    if (roleFilter && (roleFilter === "ADMIN" || roleFilter === "VOLUNTEER")) {
      conditions.push(Prisma.sql`u.role = ${roleFilter}::text`);
    }

    if (locationFilter) {
      if (locationScope === "default") {
        conditions.push(Prisma.sql`u."defaultLocation" = ${locationFilter}`);
      } else {
        // Same default-or-available matching as the Prisma path above
        conditions.push(Prisma.sql`(
          u."defaultLocation" = ${locationFilter}
          OR POSITION(${`"${locationFilter}"`} IN u."availableLocations") > 0
          OR btrim(u."availableLocations") = ${locationFilter}
        )`);
      }
    }

    if (archivedFilter === "active") {
      conditions.push(Prisma.sql`u."archivedAt" IS NULL`);
    } else if (archivedFilter === "archived") {
      conditions.push(Prisma.sql`u."archivedAt" IS NOT NULL`);
    }

    if (conditions.length > 0) {
      const combined = conditions.reduce(
        (acc, cond) => Prisma.sql`${acc} AND ${cond}`
      );
      whereCondition = Prisma.sql`WHERE ${combined}`;
      countWhereCondition = Prisma.sql`WHERE ${combined}`;
    }

    // Query to get user IDs sorted by completed signup count (including manual adjustment)
    const userIdsWithCount = await prisma.$queryRaw<
      Array<{ id: string; signup_count: bigint }>
    >`
      SELECT
        u.id,
        (COUNT(DISTINCT s.id) FILTER (
          WHERE s.status = 'CONFIRMED'
          AND sh.end < ${now}
        ) + COALESCE(u."completedShiftAdjustment", 0)) as signup_count
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
          completedShiftAdjustment: true,
          createdAt: true,
          archivedAt: true,
          archiveReason: true,
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

    const listPromise = prisma.user.findMany({
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
        completedShiftAdjustment: true,
        createdAt: true,
        archivedAt: true,
        archiveReason: true,
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

    // The list and its total both scan the same filtered set — run them together
    // rather than paying for two serial round-trips.
    const [result, count] = await Promise.all([
      listPromise,
      prisma.user.count({ where: whereClause }),
    ]);

    users = result;
    filteredCount = count;
  }

  const [
    locations,
    totalUsers,
    totalAdmins,
    totalVolunteers,
    newUsersThisMonth,
    totalArchived,
  ] = await headerDataPromise;

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
            <KpiTile
              data-testid="total-users-stat"
              valueTestId="total-users-count"
              tone="neutral"
              icon={<Users />}
              label="Total users"
              value={totalUsers}
            />
            <KpiTile
              data-testid="volunteers-stat"
              valueTestId="volunteers-count"
              tone="forest"
              icon={<Users />}
              label="Volunteers"
              value={totalVolunteers}
            />
            <KpiTile
              data-testid="admins-stat"
              valueTestId="admins-count"
              tone="neutral"
              icon={<Shield />}
              label="Admins"
              value={totalAdmins}
            />
            <KpiTile
              data-testid="new-users-stat"
              valueTestId="new-users-count"
              tone="sun"
              icon={<UserPlus />}
              label="New this month"
              value={newUsersThisMonth}
            />
          </div>
        </section>

        {/* Search and Filters */}
        <AdminUsersSearch
          initialSearch={searchQuery}
          roleFilter={roleFilter}
          locationFilter={locationFilter}
          locationScope={locationScope}
          archivedFilter={archivedFilter}
          archivedCount={totalArchived}
          locations={locations.map((l) => l.name)}
        />

        {/* Users DataTable */}
        <section data-testid="users-section">
          {users.length === 0 ? (
            <EmptyState
              data-testid="no-users-message"
              className="rounded-xl border bg-card"
              icon={Users}
              title="No users found"
              description={
                searchQuery || roleFilter || locationFilter
                  ? "Nobody matches these filters. Try a different search or clear a filter."
                  : "Invite your first user to get started."
              }
              action={
                !searchQuery &&
                !roleFilter &&
                !locationFilter && (
                  <InviteUserDialog>
                    <Button
                      className="btn-primary gap-2"
                      data-testid="invite-first-user-button"
                    >
                      <UserPlus className="h-4 w-4" />
                      Invite first user
                    </Button>
                  </InviteUserDialog>
                )
              }
            />
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
