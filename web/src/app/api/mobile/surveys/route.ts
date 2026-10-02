import { NextResponse } from "next/server";

import { requireMobileUser } from "@/lib/mobile-auth";
import { getOpenSurveyAssignments } from "@/lib/survey-assignments";
import { checkAndAssignSurveys } from "@/lib/survey-triggers";

/**
 * GET /api/mobile/surveys
 *
 * The surveys waiting on this volunteer, for the card on the app's home tab.
 * Mobile twin of the web dashboard banner: only PENDING ones are returned, a
 * survey they chose "don't ask again" on stays reachable from its notification.
 *
 * Milestone surveys are assigned here as well as listed. On the web that
 * happens when the dashboard loads its achievements; a volunteer who only uses
 * the app never loads that page, so without this they would never be asked.
 * Doing it in the same request means a survey they have just become due for is
 * already in the response.
 *
 * Answering goes through the public token routes the web survey page uses:
 * GET /api/surveys/[token] and POST /api/surveys/[token]/submit.
 */
export async function GET(request: Request) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Never throws: a failed evaluation is logged and the list still loads.
    await checkAndAssignSurveys(auth.userId);

    const assignments = await getOpenSurveyAssignments(auth.userId, [
      "PENDING",
    ]);

    return NextResponse.json({
      surveys: assignments.flatMap((assignment) =>
        // Without a token there is nothing the app could open.
        assignment.token
          ? [
              {
                assignmentId: assignment.id,
                token: assignment.token,
                title: assignment.survey.title,
                description: assignment.survey.description,
                questionCount: assignment.questionCount,
                assignedAt: assignment.assignedAt,
              },
            ]
          : []
      ),
    });
  } catch (error) {
    console.error("Error fetching mobile surveys:", error);
    return NextResponse.json(
      { error: "Failed to fetch surveys" },
      { status: 500 }
    );
  }
}
