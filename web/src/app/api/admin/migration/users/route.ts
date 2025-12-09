import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

const isTokenExpired = (expiresAt: Date | null): boolean => {
  if (!expiresAt) return false;
  return expiresAt < new Date();
};

export async function GET(request: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get pagination parameters from query string
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "50");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "all";
    const includeStats = searchParams.get("includeStats") === "true";
    const sortBy = searchParams.get("sortBy") || "createdAt-desc";

    // Calculate skip and take for pagination
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // Determine if we need to sort by signup count or migration status (which requires in-memory sorting)
    const sortBySignups = sortBy.startsWith("signups-");
    const sortByMigrationStatus = sortBy.startsWith("migration-status-");

    // Build orderBy clause for database queries (used when not sorting by signups or migration status)
    const getOrderBy = () => {
      if (sortBySignups || sortByMigrationStatus) {
        // Default sorting for database query when we'll sort in-memory
        return { createdAt: "desc" as const };
      }

      switch (sortBy) {
        case "name-asc":
          return { firstName: "asc" as const };
        case "name-desc":
          return { firstName: "desc" as const };
        case "email-asc":
          return { email: "asc" as const };
        case "email-desc":
          return { email: "desc" as const };
        case "createdAt-asc":
          return { createdAt: "asc" as const };
        case "createdAt-desc":
        default:
          return { createdAt: "desc" as const };
      }
    };

    // Build base where clause
    const baseWhere: {
      isMigrated: boolean;
      role: "VOLUNTEER";
      OR?: Array<{
        email?: { contains: string; mode: "insensitive" };
        firstName?: { contains: string; mode: "insensitive" };
        lastName?: { contains: string; mode: "insensitive" };
      }>;
    } = {
      isMigrated: true,
      role: "VOLUNTEER" as const,
    };

    // Add search filter
    if (search) {
      baseWhere.OR = [
        { email: { contains: search, mode: "insensitive" as const } },
        { firstName: { contains: search, mode: "insensitive" as const } },
        { lastName: { contains: search, mode: "insensitive" as const } },
      ];
    }

    // Build where clause with status filter
    // Note: For "expired" and "invited" statuses, we need to fetch all and filter in-memory
    // since we can't compare dates in Prisma where clause for tokenExpiresAt
    const where: {
      isMigrated: boolean;
      role: "VOLUNTEER";
      OR?: Array<{
        email?: { contains: string; mode: "insensitive" };
        firstName?: { contains: string; mode: "insensitive" };
        lastName?: { contains: string; mode: "insensitive" };
      }>;
      migrationInvitationSent?: boolean;
      profileCompleted?: boolean;
    } = { ...baseWhere };

    if (status === "pending") {
      where.migrationInvitationSent = false;
    } else if (status === "completed") {
      where.profileCompleted = true;
    } else if (status === "invited") {
      // Invited: invitation sent, not completed, token not expired
      where.migrationInvitationSent = true;
      where.profileCompleted = false;
    } else if (status === "expired") {
      // Expired: invitation sent, not completed, token expired
      where.migrationInvitationSent = true;
      where.profileCompleted = false;
    }

    // For "invited" and "expired" statuses, we need to fetch more users and filter by date
    let allUsers;
    let filteredUsers;

    if (status === "invited" || status === "expired") {
      // Fetch all matching users (with search filter) to filter by token expiration
      allUsers = await prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          createdAt: true,
          profileCompleted: true,
          isMigrated: true,
          migrationInvitationSent: true,
          migrationInvitationSentAt: true,
          migrationInvitationCount: true,
          migrationLastSentAt: true,
          migrationTokenExpiresAt: true,
          _count: {
            select: {
              signups: true,
            },
          },
        },
        orderBy: getOrderBy(),
      });

      // Filter by token expiration in-memory
      if (status === "invited") {
        filteredUsers = allUsers.filter((user) => !isTokenExpired(user.migrationTokenExpiresAt));
      } else {
        filteredUsers = allUsers.filter((user) => isTokenExpired(user.migrationTokenExpiresAt));
      }

      // Sort by signup count if requested
      if (sortBySignups) {
        filteredUsers.sort((a, b) => {
          const signupsA = a._count.signups;
          const signupsB = b._count.signups;
          return sortBy === "signups-desc"
            ? signupsB - signupsA
            : signupsA - signupsB;
        });
      }

      // Sort by migration status (hasHistoricalData) if requested
      if (sortByMigrationStatus) {
        filteredUsers.sort((a, b) => {
          const hasDataA = a._count.signups > 0 ? 1 : 0;
          const hasDataB = b._count.signups > 0 ? 1 : 0;
          return sortBy === "migration-status-desc"
            ? hasDataB - hasDataA
            : hasDataA - hasDataB;
        });
      }

      // Apply pagination to filtered results
      const totalCount = filteredUsers.length;
      const paginatedUsers = filteredUsers.slice(skip, skip + take);

      // Transform users
      const usersWithInvitationStatus = paginatedUsers.map((user) => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        invitationSent: user.migrationInvitationSent,
        invitationSentAt: user.migrationInvitationSentAt?.toISOString(),
        invitationCount: user.migrationInvitationCount,
        lastSentAt: user.migrationLastSentAt?.toISOString(),
        tokenExpiresAt: user.migrationTokenExpiresAt?.toISOString(),
        registrationCompleted: user.profileCompleted,
        registrationCompletedAt: null,
        signupCount: user._count.signups,
        hasHistoricalData: user._count.signups > 0,
      }));

      // Calculate stats if requested
      let stats;
      if (includeStats) {
        const allMigratedUsers = await prisma.user.findMany({
          where: baseWhere,
          select: {
            migrationInvitationSent: true,
            profileCompleted: true,
            migrationTokenExpiresAt: true,
          },
        });

        stats = {
          total: allMigratedUsers.length,
          pending: allMigratedUsers.filter((u) => !u.migrationInvitationSent).length,
          invited: allMigratedUsers.filter(
            (u) =>
              u.migrationInvitationSent &&
              !u.profileCompleted &&
              !isTokenExpired(u.migrationTokenExpiresAt)
          ).length,
          expired: allMigratedUsers.filter(
            (u) =>
              u.migrationInvitationSent &&
              !u.profileCompleted &&
              isTokenExpired(u.migrationTokenExpiresAt)
          ).length,
          completed: allMigratedUsers.filter((u) => u.profileCompleted).length,
        };
      }

      return NextResponse.json({
        users: usersWithInvitationStatus,
        total: totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
        ...(stats && { stats }),
      });
    }

    // For other statuses, use regular pagination
    const totalCount = await prisma.user.count({ where });

    let users;

    // If sorting by signups or migration status, we need to fetch all users and sort in-memory
    if (sortBySignups || sortByMigrationStatus) {
      const allUsers = await prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          createdAt: true,
          profileCompleted: true,
          isMigrated: true,
          migrationInvitationSent: true,
          migrationInvitationSentAt: true,
          migrationInvitationCount: true,
          migrationLastSentAt: true,
          migrationTokenExpiresAt: true,
          _count: {
            select: {
              signups: true,
            },
          },
        },
      });

      // Sort by signup count
      if (sortBySignups) {
        allUsers.sort((a, b) => {
          const signupsA = a._count.signups;
          const signupsB = b._count.signups;
          return sortBy === "signups-desc"
            ? signupsB - signupsA
            : signupsA - signupsB;
        });
      }

      // Sort by migration status (hasHistoricalData)
      if (sortByMigrationStatus) {
        allUsers.sort((a, b) => {
          const hasDataA = a._count.signups > 0 ? 1 : 0;
          const hasDataB = b._count.signups > 0 ? 1 : 0;
          return sortBy === "migration-status-desc"
            ? hasDataB - hasDataA
            : hasDataA - hasDataB;
        });
      }

      // Apply pagination
      users = allUsers.slice(skip, skip + take);
    } else {
      // Use database ordering for other sort options
      users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          createdAt: true,
          profileCompleted: true,
          isMigrated: true,
          migrationInvitationSent: true,
          migrationInvitationSentAt: true,
          migrationInvitationCount: true,
          migrationLastSentAt: true,
          migrationTokenExpiresAt: true,
          _count: {
            select: {
              signups: true,
            },
          },
        },
        orderBy: getOrderBy(),
        skip,
        take,
      });
    }

    // Transform users to include invitation status and signup count
    const usersWithInvitationStatus = users.map((user) => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      invitationSent: user.migrationInvitationSent,
      invitationSentAt: user.migrationInvitationSentAt?.toISOString(),
      invitationCount: user.migrationInvitationCount,
      lastSentAt: user.migrationLastSentAt?.toISOString(),
      tokenExpiresAt: user.migrationTokenExpiresAt?.toISOString(),
      registrationCompleted: user.profileCompleted,
      registrationCompletedAt: null,
      signupCount: user._count.signups,
      hasHistoricalData: user._count.signups > 0,
    }));

    // Calculate stats if requested
    let stats;
    if (includeStats) {
      const allMigratedUsers = await prisma.user.findMany({
        where: baseWhere,
        select: {
          migrationInvitationSent: true,
          profileCompleted: true,
          migrationTokenExpiresAt: true,
        },
      });

      stats = {
        total: allMigratedUsers.length,
        pending: allMigratedUsers.filter((u) => !u.migrationInvitationSent).length,
        invited: allMigratedUsers.filter(
          (u) =>
            u.migrationInvitationSent &&
            !u.profileCompleted &&
            !isTokenExpired(u.migrationTokenExpiresAt)
        ).length,
        expired: allMigratedUsers.filter(
          (u) =>
            u.migrationInvitationSent &&
            !u.profileCompleted &&
            isTokenExpired(u.migrationTokenExpiresAt)
        ).length,
        completed: allMigratedUsers.filter((u) => u.profileCompleted).length,
      };
    }

    return NextResponse.json({
      users: usersWithInvitationStatus,
      total: totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
      ...(stats && { stats }),
    });
  } catch (error) {
    console.error("Failed to fetch migrated users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
