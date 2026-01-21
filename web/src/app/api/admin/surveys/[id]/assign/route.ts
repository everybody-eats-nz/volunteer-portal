import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { manuallyAssignSurvey } from "@/lib/survey-triggers";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/admin/surveys/[id]/assign - Manually assign survey to users
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id: surveyId } = await params;
    const body = await request.json();
    const { userIds } = body as { userIds: string[] };

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: "At least one user ID is required" },
        { status: 400 }
      );
    }

    const result = await manuallyAssignSurvey(surveyId, userIds);

    return NextResponse.json({
      message: `Survey assigned to ${result.assigned.length} user(s)`,
      assigned: result.assigned,
      skipped: result.skipped,
    });
  } catch (error) {
    console.error("Error assigning survey:", error);
    const message =
      error instanceof Error ? error.message : "Failed to assign survey";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
