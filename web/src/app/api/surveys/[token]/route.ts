import { NextRequest, NextResponse } from "next/server";
import { validateSurveyToken } from "@/lib/survey-tokens";

interface RouteParams {
  params: Promise<{ token: string }>;
}

// GET /api/surveys/[token] - Get survey by token (public, no auth required)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;

    const result = await validateSurveyToken(token);

    if (!result.valid || !result.assignment) {
      return NextResponse.json(
        { error: result.message, valid: false },
        { status: result.message.includes("expired") ? 410 : 404 }
      );
    }

    // Return survey details without sensitive data
    return NextResponse.json({
      valid: true,
      survey: {
        id: result.assignment.survey.id,
        title: result.assignment.survey.title,
        description: result.assignment.survey.description,
        questions: result.assignment.survey.questions,
      },
      assignment: {
        id: result.assignment.id,
        assignedAt: result.assignment.assignedAt,
        status: result.assignment.status,
      },
      user: {
        name: result.assignment.user.name,
      },
      expiresAt: result.token?.expiresAt,
    });
  } catch (error) {
    console.error("Error validating survey token:", error);
    return NextResponse.json(
      { error: "Failed to validate survey token", valid: false },
      { status: 500 }
    );
  }
}
