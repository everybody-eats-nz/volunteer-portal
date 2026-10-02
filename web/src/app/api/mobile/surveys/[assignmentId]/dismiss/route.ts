import { NextResponse } from "next/server";

import { requireMobileUser } from "@/lib/mobile-auth";
import { dismissSurveyAssignment } from "@/lib/survey-assignments";

/**
 * POST /api/mobile/surveys/[assignmentId]/dismiss
 *
 * "Don't ask again" on the home tab's survey card. Mobile twin of
 * POST /api/surveys/assignments/[assignmentId]/dismiss.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { assignmentId } = await params;
    const result = await dismissSurveyAssignment(auth.userId, assignmentId);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error dismissing mobile survey:", error);
    return NextResponse.json(
      { error: "Failed to dismiss survey" },
      { status: 500 }
    );
  }
}
