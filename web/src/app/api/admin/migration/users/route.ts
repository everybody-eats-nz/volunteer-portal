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

    // Get migrated users (users marked as migrated)
    const users = await prisma.user.findMany({
      where: {
        isMigrated: true,
        role: "VOLUNTEER",
      },
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
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Transform users to include invitation status
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
    }));

    return NextResponse.json({
      users: usersWithInvitationStatus,
      total: users.length,
    });
  } catch (error) {
    console.error("Failed to fetch migrated users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
