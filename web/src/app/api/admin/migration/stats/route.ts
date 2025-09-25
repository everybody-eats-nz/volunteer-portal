import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get migration statistics
    const [
      totalMigrated,
      pendingInvitations,
      completedRegistrations,
      failedInvitations,
      recentUsers,
    ] = await Promise.all([
      // Total migrated users
      prisma.user.count({
        where: {
          isMigrated: true,
          role: "VOLUNTEER",
        },
      }),

      // Pending invitations (migrated but not completed profile)
      prisma.user.count({
        where: {
          isMigrated: true,
          role: "VOLUNTEER",
          profileCompleted: false,
          migrationInvitationSent: true,
        },
      }),

      // Completed registrations (migrated and completed profile)
      prisma.user.count({
        where: {
          isMigrated: true,
          role: "VOLUNTEER",
          profileCompleted: true,
        },
      }),

      // Failed invitations (no current way to track this, so return 0)
      Promise.resolve(0),

      // Recent migrated users for activity feed
      prisma.user.findMany({
        where: {
          isMigrated: true,
          role: "VOLUNTEER",
        },
        select: {
          id: true,
          email: true,
          createdAt: true,
          profileCompleted: true,
          migrationInvitationSent: true,
          migrationInvitationSentAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
      }),
    ]);

    // Get the last migration date
    const lastMigration = await prisma.user.findFirst({
      where: {
        isMigrated: true,
        role: "VOLUNTEER",
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        createdAt: true,
      },
    });

    // Transform recent users into activity items
    const recentActivity = recentUsers.map((user) => {
      let type: "migration" | "invitation" | "registration" = "migration";
      let status: "success" | "failed" | "pending" = "success";

      if (user.profileCompleted) {
        type = "registration";
        status = "success";
      } else if (user.migrationInvitationSent) {
        type = "invitation";
        status = "pending";
      }

      return {
        id: user.id,
        type,
        email: user.email,
        status,
        timestamp: (
          user.migrationInvitationSentAt || user.createdAt
        ).toISOString(),
      };
    });

    return NextResponse.json({
      totalMigrated,
      pendingInvitations,
      completedRegistrations,
      failedInvitations,
      lastMigrationDate: lastMigration?.createdAt.toISOString(),
      recentActivity,
    });
  } catch (error) {
    console.error("Failed to fetch migration stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch migration statistics" },
      { status: 500 }
    );
  }
}
