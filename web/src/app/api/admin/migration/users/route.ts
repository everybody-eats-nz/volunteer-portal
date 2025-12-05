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

    // Calculate skip and take for pagination
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // Build base where clause
    const baseWhere: any = {
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
    let where = { ...baseWhere };

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
        orderBy: {
          createdAt: "desc",
        },
      });

      // Filter by token expiration in-memory
      if (status === "invited") {
        filteredUsers = allUsers.filter((user) => !isTokenExpired(user.migrationTokenExpiresAt));
      } else {
        filteredUsers = allUsers.filter((user) => isTokenExpired(user.migrationTokenExpiresAt));
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

    const users = await prisma.user.findMany({
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
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take,
    });

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
