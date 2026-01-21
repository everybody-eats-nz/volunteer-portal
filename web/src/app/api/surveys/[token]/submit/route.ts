import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateSurveyToken, markTokenAsUsed } from "@/lib/survey-tokens";
import type { SurveyAnswer, SurveyQuestion } from "@/types/survey";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { updateUnreadCount } from "@/lib/notification-helpers";

interface RouteParams {
  params: Promise<{ token: string }>;
}

// POST /api/surveys/[token]/submit - Submit survey response (public, no auth required)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;
    const body = await request.json();
    const { answers } = body as { answers: SurveyAnswer[] };

    // Validate token
    const result = await validateSurveyToken(token);

    if (!result.valid || !result.assignment) {
      return NextResponse.json(
        { error: result.message, success: false },
        { status: result.message.includes("expired") ? 410 : 404 }
      );
    }

    // Validate answers
    if (!answers || !Array.isArray(answers)) {
      return NextResponse.json(
        { error: "Answers are required", success: false },
        { status: 400 }
      );
    }

    // Get questions from survey
    const questions = result.assignment.survey.questions as SurveyQuestion[];
    const questionMap = new Map(questions.map((q) => [q.id, q]));

    // Validate required questions are answered
    for (const question of questions) {
      if (question.required) {
        const answer = answers.find((a) => a.questionId === question.id);
        if (!answer || answer.value === null || answer.value === undefined) {
          return NextResponse.json(
            { error: `Question "${question.text}" is required`, success: false },
            { status: 400 }
          );
        }

        // Check for empty values
        const value = answer.value;
        if (typeof value === "string" && !value.trim()) {
          return NextResponse.json(
            { error: `Question "${question.text}" is required`, success: false },
            { status: 400 }
          );
        }

        if (Array.isArray(value) && value.length === 0) {
          return NextResponse.json(
            { error: `Question "${question.text}" is required`, success: false },
            { status: 400 }
          );
        }
      }
    }

    // Validate answer types match question types
    for (const answer of answers) {
      const question = questionMap.get(answer.questionId);
      if (!question) continue; // Skip unknown questions

      const value = answer.value;
      if (value === null || value === undefined) continue;

      switch (question.type) {
        case "text_short":
        case "text_long":
          if (typeof value !== "string") {
            return NextResponse.json(
              { error: `Invalid answer type for "${question.text}"`, success: false },
              { status: 400 }
            );
          }
          break;

        case "multiple_choice_single":
          if (typeof value !== "string") {
            return NextResponse.json(
              { error: `Invalid answer type for "${question.text}"`, success: false },
              { status: 400 }
            );
          }
          if (question.options && !question.options.includes(value)) {
            return NextResponse.json(
              { error: `Invalid option selected for "${question.text}"`, success: false },
              { status: 400 }
            );
          }
          break;

        case "multiple_choice_multi":
          if (!Array.isArray(value)) {
            return NextResponse.json(
              { error: `Invalid answer type for "${question.text}"`, success: false },
              { status: 400 }
            );
          }
          if (question.options) {
            for (const v of value) {
              if (!question.options.includes(v)) {
                return NextResponse.json(
                  { error: `Invalid option selected for "${question.text}"`, success: false },
                  { status: 400 }
                );
              }
            }
          }
          break;

        case "rating_scale":
          const numValue = typeof value === "number" ? value : Number(value);
          if (isNaN(numValue)) {
            return NextResponse.json(
              { error: `Invalid rating for "${question.text}"`, success: false },
              { status: 400 }
            );
          }
          const min = question.minValue ?? 1;
          const max = question.maxValue ?? 5;
          if (numValue < min || numValue > max) {
            return NextResponse.json(
              { error: `Rating for "${question.text}" must be between ${min} and ${max}`, success: false },
              { status: 400 }
            );
          }
          break;

        case "yes_no":
          if (typeof value !== "boolean" && value !== "yes" && value !== "no") {
            return NextResponse.json(
              { error: `Invalid answer for "${question.text}"`, success: false },
              { status: 400 }
            );
          }
          break;
      }
    }

    // Create response and update assignment in a transaction
    await prisma.$transaction(async (tx) => {
      // Create the response
      await tx.surveyResponse.create({
        data: {
          assignmentId: result.assignment!.id,
          answers: answers as unknown as object[],
        },
      });

      // Update assignment status
      await tx.surveyAssignment.update({
        where: { id: result.assignment!.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });
    });

    // Mark token as used
    await markTokenAsUsed(token);

    // Dismiss the survey notification
    const assignmentUserId = result.assignment.user.id;
    try {
      const notification = await prisma.notification.updateMany({
        where: {
          userId: assignmentUserId,
          type: "SURVEY_ASSIGNED",
          relatedId: result.assignment.id,
          isRead: false,
        },
        data: {
          isRead: true,
        },
      });

      // Update unread count if we dismissed a notification
      if (notification.count > 0) {
        const unreadCount = await getUnreadNotificationCount(assignmentUserId);
        updateUnreadCount(assignmentUserId, unreadCount).catch((error) => {
          console.error("Error updating unread count:", error);
        });
      }
    } catch (notificationError) {
      // Don't fail the submission if notification update fails
      console.error("Error dismissing survey notification:", notificationError);
    }

    return NextResponse.json({
      success: true,
      message: "Survey submitted successfully",
    });
  } catch (error) {
    console.error("Error submitting survey:", error);
    return NextResponse.json(
      { error: "Failed to submit survey", success: false },
      { status: 500 }
    );
  }
}
