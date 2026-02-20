import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  findEligibleUsersForSurvey,
  manuallyAssignSurvey,
} from "@/lib/survey-triggers";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/surveys/[id]/bulk-assign - Preview eligible users
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id: surveyId } = await params;
    const result = await findEligibleUsersForSurvey(surveyId);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error previewing bulk assignment:", error);
    const message =
      error instanceof Error ? error.message : "Failed to preview bulk assignment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const BATCH_SIZE = 50;

// POST /api/admin/surveys/[id]/bulk-assign - Execute bulk assignment
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id: surveyId } = await params;
    const { eligibleUserIds, totalEligible } =
      await findEligibleUsersForSurvey(surveyId);

    if (eligibleUserIds.length === 0) {
      return NextResponse.json({
        totalAssigned: 0,
        totalSkipped: 0,
        totalEligible: 0,
        message: "No eligible users found",
      });
    }

    let totalAssigned = 0;
    let totalSkipped = 0;

    // Process in batches to avoid overloading the database
    for (let i = 0; i < eligibleUserIds.length; i += BATCH_SIZE) {
      const batch = eligibleUserIds.slice(i, i + BATCH_SIZE);
      const result = await manuallyAssignSurvey(surveyId, batch);
      totalAssigned += result.assigned.length;
      totalSkipped += result.skipped.length;
    }

    return NextResponse.json({
      totalAssigned,
      totalSkipped,
      totalEligible,
      message: `Survey assigned to ${totalAssigned} user(s)`,
    });
  } catch (error) {
    console.error("Error executing bulk assignment:", error);
    const message =
      error instanceof Error ? error.message : "Failed to execute bulk assignment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
