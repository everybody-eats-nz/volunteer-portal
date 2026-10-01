import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getUsersRequiringParentalConsent } from "@/lib/parental-consent";

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

    // Get all users under 16 who require parental consent (exclude archived)
    const usersRequiringConsent = await getUsersRequiringParentalConsent();

    return NextResponse.json({ users: usersRequiringConsent });
  } catch (error) {
    console.error("Error fetching users requiring parental consent:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}