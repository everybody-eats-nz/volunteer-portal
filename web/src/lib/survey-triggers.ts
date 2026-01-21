import { prisma } from "./prisma";
import { calculateUserProgress, type UserProgress } from "./achievements";
import { createSurveyToken, getSurveyUrl } from "./survey-tokens";
import { createNotification } from "./notifications";
import { sendSurveyNotification } from "./email-service";
import type { SurveyTriggerType } from "@/generated/client";
import { differenceInDays } from "date-fns";

interface EvaluateTriggerResult {
  triggered: boolean;
  reason?: string;
}

/**
 * Evaluate if a survey trigger condition is met for a user
 */
function evaluateTrigger(
  triggerType: SurveyTriggerType,
  triggerValue: number,
  progress: UserProgress,
  userCreatedAt: Date,
  firstShiftDate: Date | null
): EvaluateTriggerResult {
  switch (triggerType) {
    case "SHIFTS_COMPLETED":
      if (progress.shifts_completed >= triggerValue) {
        return {
          triggered: true,
          reason: `Completed ${progress.shifts_completed} shifts (target: ${triggerValue})`,
        };
      }
      return { triggered: false };

    case "HOURS_VOLUNTEERED":
      if (progress.hours_volunteered >= triggerValue) {
        return {
          triggered: true,
          reason: `Volunteered ${progress.hours_volunteered} hours (target: ${triggerValue})`,
        };
      }
      return { triggered: false };

    case "FIRST_SHIFT":
      if (firstShiftDate) {
        const daysSinceFirstShift = differenceInDays(new Date(), firstShiftDate);
        if (daysSinceFirstShift >= triggerValue) {
          return {
            triggered: true,
            reason: `${daysSinceFirstShift} days since first shift (target: ${triggerValue})`,
          };
        }
      }
      return { triggered: false };

    case "MANUAL":
      // Manual surveys are never automatically triggered
      return { triggered: false };

    default:
      return { triggered: false };
  }
}

/**
 * Check and assign surveys for a user based on their progress
 * This should be called after achievements are checked
 */
export async function checkAndAssignSurveys(userId: string): Promise<string[]> {
  const assignedSurveys: string[] = [];

  try {
    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    if (!user) {
      return assignedSurveys;
    }

    // Get user's progress
    const progress = await calculateUserProgress(userId);

    // Get user's first completed shift date
    const firstShift = await prisma.signup.findFirst({
      where: {
        userId,
        status: "CONFIRMED",
        shift: { end: { lt: new Date() } },
      },
      orderBy: { shift: { start: "asc" } },
      include: { shift: true },
    });

    const firstShiftDate = firstShift?.shift.start || null;

    // Get active surveys the user hasn't been assigned yet
    const existingAssignments = await prisma.surveyAssignment.findMany({
      where: { userId },
      select: { surveyId: true },
    });

    const assignedSurveyIds = new Set(
      existingAssignments.map((a) => a.surveyId)
    );

    const eligibleSurveys = await prisma.survey.findMany({
      where: {
        isActive: true,
        id: { notIn: Array.from(assignedSurveyIds) },
        triggerType: { not: "MANUAL" }, // Don't auto-assign manual surveys
      },
    });

    // Evaluate each survey's trigger conditions
    for (const survey of eligibleSurveys) {
      const result = evaluateTrigger(
        survey.triggerType,
        survey.triggerValue,
        progress,
        user.createdAt,
        firstShiftDate
      );

      if (result.triggered) {
        // Create assignment
        const assignment = await prisma.surveyAssignment.create({
          data: {
            surveyId: survey.id,
            userId,
            status: "PENDING",
          },
        });

        // Create token for email link
        const token = await createSurveyToken(assignment.id);
        const surveyUrl = getSurveyUrl(token.token);

        // Create notification
        await createNotification({
          userId,
          type: "SURVEY_ASSIGNED",
          title: "New Survey Available",
          message: `We'd love your feedback! Please complete the "${survey.title}" survey.`,
          actionUrl: `/surveys/${token.token}`,
          relatedId: assignment.id,
        });

        // Send email notification
        try {
          await sendSurveyNotification({
            email: user.email,
            userName: user.name || "Volunteer",
            surveyTitle: survey.title,
            surveyUrl,
          });
        } catch (emailError) {
          console.error(
            `Failed to send survey email to ${user.email}:`,
            emailError
          );
          // Continue even if email fails - they can still see it on dashboard
        }

        assignedSurveys.push(survey.title);
      }
    }
  } catch (error) {
    console.error("Error checking survey triggers:", error);
  }

  return assignedSurveys;
}

/**
 * Manually assign a survey to specific users (for MANUAL trigger type)
 */
export async function manuallyAssignSurvey(
  surveyId: string,
  userIds: string[]
): Promise<{ assigned: string[]; skipped: string[] }> {
  const assigned: string[] = [];
  const skipped: string[] = [];

  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
  });

  if (!survey || !survey.isActive) {
    throw new Error("Survey not found or inactive");
  }

  for (const userId of userIds) {
    // Check if already assigned
    const existing = await prisma.surveyAssignment.findUnique({
      where: {
        surveyId_userId: { surveyId, userId },
      },
    });

    if (existing) {
      skipped.push(userId);
      continue;
    }

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (!user) {
      skipped.push(userId);
      continue;
    }

    // Create assignment
    const assignment = await prisma.surveyAssignment.create({
      data: {
        surveyId,
        userId,
        status: "PENDING",
      },
    });

    // Create token
    const token = await createSurveyToken(assignment.id);
    const surveyUrl = getSurveyUrl(token.token);

    // Create notification
    await createNotification({
      userId,
      type: "SURVEY_ASSIGNED",
      title: "New Survey Available",
      message: `We'd love your feedback! Please complete the "${survey.title}" survey.`,
      actionUrl: `/surveys/${token.token}`,
      relatedId: assignment.id,
    });

    // Send email
    try {
      await sendSurveyNotification({
        email: user.email,
        userName: user.name || "Volunteer",
        surveyTitle: survey.title,
        surveyUrl,
      });
    } catch (emailError) {
      console.error(`Failed to send survey email to ${user.email}:`, emailError);
    }

    assigned.push(userId);
  }

  return { assigned, skipped };
}
