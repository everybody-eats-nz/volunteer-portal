import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

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

    // Calculate skip and take for pagination
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // Build where clause with search
    const where = {
      isMigrated: true,
      role: "VOLUNTEER" as const,
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: "insensitive" as const } },
              { firstName: { contains: search, mode: "insensitive" as const } },
              { lastName: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    // Get total count for pagination
    const totalCount = await prisma.user.count({ where });

    // Get migrated users (users marked as migrated) with pagination
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
      registrationCompleted: user.profileCompleted, // Check actual profile completion status
      registrationCompletedAt: null,
      signupCount: user._count.signups,
      hasHistoricalData: user._count.signups > 0,
    }));

    return NextResponse.json({
      users: usersWithInvitationStatus,
      total: totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
    });
  } catch (error) {
    console.error("Failed to fetch migrated users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
