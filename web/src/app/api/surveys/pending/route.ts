import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getOpenSurveyAssignments } from "@/lib/survey-assignments";

// GET /api/surveys/pending - Get pending surveys for current user
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Pending and dismissed assignments (not completed or expired)
    const assignments = await getOpenSurveyAssignments(user.id);

    return NextResponse.json(assignments);
  } catch (error) {
    console.error("Error fetching pending surveys:", error);
    return NextResponse.json(
      { error: "Failed to fetch pending surveys" },
      { status: 500 }
    );
  }
}
