import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/parental-consent
 * Retrieves list of volunteers requiring parental consent approval
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get all users under 18 who require parental consent
    const usersRequiringConsent = await prisma.user.findMany({
      where: {
        requiresParentalConsent: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        parentalConsentReceived: true,
        parentalConsentReceivedAt: true,
        parentalConsentApprovedBy: true,
        profileCompleted: true,
        createdAt: true,
        phone: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
      },
      orderBy: [
        { parentalConsentReceived: 'asc' }, // Show pending first
        { createdAt: 'desc' }
      ]
    });

    return NextResponse.json({ users: usersRequiringConsent });
  } catch (error) {
    console.error("Error fetching users requiring parental consent:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}