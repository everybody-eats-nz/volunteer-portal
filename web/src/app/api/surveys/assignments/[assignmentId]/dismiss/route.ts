import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { dismissSurveyAssignment } from "@/lib/survey-assignments";

interface RouteParams {
  params: Promise<{ assignmentId: string }>;
}

// POST /api/surveys/assignments/[assignmentId]/dismiss - Dismiss a survey (authenticated)
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { assignmentId } = await params;

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const result = await dismissSurveyAssignment(user.id, assignmentId);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Survey dismissed. You can still access it via the email link.",
    });
  } catch (error) {
    console.error("Error dismissing survey:", error);
    return NextResponse.json(
      { error: "Failed to dismiss survey" },
      { status: 500 }
    );
  }
}
