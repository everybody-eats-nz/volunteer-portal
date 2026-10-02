import { prisma } from "./prisma";
import type { SurveyAssignmentStatus } from "@/generated/client";

/**
 * A survey a volunteer has been asked to fill in and hasn't yet. The shape the
 * web dashboard banner and the mobile home tab both render from.
 */
export interface OpenSurveyAssignment {
  id: string;
  status: SurveyAssignmentStatus;
  assignedAt: Date;
  dismissedAt: Date | null;
  survey: {
    id: string;
    title: string;
    description: string | null;
  };
  questionCount: number;
  /** Missing only on legacy rows whose token was never created. */
  token: string | undefined;
  expiresAt: Date | null | undefined;
}

/**
 * Surveys still waiting on this volunteer, newest first.
 *
 * PENDING ones are shown to them. DISMISSED ones ("don't ask again") are
 * hidden from the dashboard but can still be answered from the notification or
 * the email link, so callers that only want to prompt pass `["PENDING"]`.
 */
export async function getOpenSurveyAssignments(
  userId: string,
  statuses: SurveyAssignmentStatus[] = ["PENDING", "DISMISSED"]
): Promise<OpenSurveyAssignment[]> {
  const assignments = await prisma.surveyAssignment.findMany({
    where: {
      userId,
      status: { in: statuses },
      survey: { isActive: true },
    },
    include: {
      survey: {
        select: {
          id: true,
          title: true,
          description: true,
          questions: true,
        },
      },
      token: {
        select: {
          token: true,
          expiresAt: true,
        },
      },
    },
    orderBy: { assignedAt: "desc" },
  });

  // Note: tokens never expire, so there is no expiry filter here.
  return assignments.map((assignment) => ({
    id: assignment.id,
    status: assignment.status,
    assignedAt: assignment.assignedAt,
    dismissedAt: assignment.dismissedAt,
    survey: {
      id: assignment.survey.id,
      title: assignment.survey.title,
      description: assignment.survey.description,
    },
    questionCount: Array.isArray(assignment.survey.questions)
      ? assignment.survey.questions.length
      : 0,
    token: assignment.token?.token,
    expiresAt: assignment.token?.expiresAt,
  }));
}

export type DismissSurveyResult =
  | { ok: true }
  | { ok: false; status: 400 | 403 | 404; error: string };

/**
 * "Don't ask again": stop prompting a volunteer about a survey. The token
 * keeps working, so they can still answer it from the notification or email.
 */
export async function dismissSurveyAssignment(
  userId: string,
  assignmentId: string
): Promise<DismissSurveyResult> {
  const assignment = await prisma.surveyAssignment.findUnique({
    where: { id: assignmentId },
    select: { userId: true, status: true },
  });

  if (!assignment) {
    return { ok: false, status: 404, error: "Survey assignment not found" };
  }

  if (assignment.userId !== userId) {
    return { ok: false, status: 403, error: "Unauthorized" };
  }

  // Dismissing twice is the same request arriving again (a retry, or the
  // phone and the website both open), not a mistake.
  if (assignment.status === "DISMISSED") {
    return { ok: true };
  }

  if (assignment.status !== "PENDING") {
    return {
      ok: false,
      status: 400,
      error: "Survey cannot be dismissed in current state",
    };
  }

  await prisma.surveyAssignment.update({
    where: { id: assignmentId },
    data: {
      status: "DISMISSED",
      dismissedAt: new Date(),
    },
  });

  return { ok: true };
}
