import { prisma } from "./prisma";
import { calculateUserProgress, type UserProgress } from "./achievements";
import { createSurveyToken, generateSurveyToken, getSurveyTokenExpiry, getSurveyUrl } from "./survey-tokens";
import { createNotification } from "./notifications";
import { sendSurveyNotification } from "./email-service";
import type { SurveyTriggerType } from "@/generated/client";
import { differenceInDays } from "date-fns";

export interface EvaluateTriggerResult {
  triggered: boolean;
  reason?: string;
}

/**
 * Evaluate if a survey trigger condition is met for a user
 * @internal Exported for testing
 */
export function evaluateTrigger(
  triggerType: SurveyTriggerType,
  triggerValue: number,
  triggerMaxValue: number | null,
  progress: UserProgress,
  userCreatedAt: Date,
  firstShiftDate: Date | null
): EvaluateTriggerResult {
  switch (triggerType) {
    case "SHIFTS_COMPLETED": {
      const value = progress.shifts_completed;
      const meetsMin = value >= triggerValue;
      const meetsMax = triggerMaxValue === null || value <= triggerMaxValue;
      if (meetsMin && meetsMax) {
        const rangeStr = triggerMaxValue !== null
          ? `${triggerValue}-${triggerMaxValue}`
          : `${triggerValue}+`;
        return {
          triggered: true,
          reason: `Completed ${value} shifts (target: ${rangeStr})`,
        };
      }
      return { triggered: false };
    }

    case "HOURS_VOLUNTEERED": {
      const value = progress.hours_volunteered;
      const meetsMin = value >= triggerValue;
      const meetsMax = triggerMaxValue === null || value <= triggerMaxValue;
      if (meetsMin && meetsMax) {
        const rangeStr = triggerMaxValue !== null
          ? `${triggerValue}-${triggerMaxValue}`
          : `${triggerValue}+`;
        return {
          triggered: true,
          reason: `Volunteered ${value} hours (target: ${rangeStr})`,
        };
      }
      return { triggered: false };
    }

    case "FIRST_SHIFT": {
      if (firstShiftDate) {
        const daysSinceFirstShift = differenceInDays(new Date(), firstShiftDate);
        const meetsMin = daysSinceFirstShift >= triggerValue;
        const meetsMax = triggerMaxValue === null || daysSinceFirstShift <= triggerMaxValue;
        if (meetsMin && meetsMax) {
          const rangeStr = triggerMaxValue !== null
            ? `${triggerValue}-${triggerMaxValue}`
            : `${triggerValue}+`;
          return {
            triggered: true,
            reason: `${daysSinceFirstShift} days since first shift (target: ${rangeStr})`,
          };
        }
      }
      return { triggered: false };
    }

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
        survey.triggerMaxValue,
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
  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
  });

  if (!survey || !survey.isActive) {
    throw new Error("Survey not found or inactive");
  }

  // Batch query: Get all existing assignments for these users
  const existingAssignments = await prisma.surveyAssignment.findMany({
    where: {
      surveyId,
      userId: { in: userIds },
    },
    select: { userId: true },
  });
  const alreadyAssignedUserIds = new Set(existingAssignments.map((a) => a.userId));

  // Filter to users who don't already have assignments
  const eligibleUserIds = userIds.filter((id) => !alreadyAssignedUserIds.has(id));

  // Batch query: Get user details for all eligible users
  const users = await prisma.user.findMany({
    where: { id: { in: eligibleUserIds } },
    select: { id: true, email: true, name: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  // Track results
  const assigned: string[] = [];
  const skipped = userIds.filter((id) => alreadyAssignedUserIds.has(id) || !userMap.has(id));

  // Create assignments, tokens, notifications, and send emails
  // These need to be done per-user because tokens and notifications depend on assignment IDs
  const eligibleUsers = eligibleUserIds.filter((id) => userMap.has(id));

  // Use a transaction to create all assignments and tokens together
  const assignmentsWithTokens = await prisma.$transaction(
    eligibleUsers.map((userId) =>
      prisma.surveyAssignment.create({
        data: {
          surveyId,
          userId,
          status: "PENDING",
          token: {
            create: {
              token: generateSurveyToken(),
              expiresAt: getSurveyTokenExpiry(),
            },
          },
        },
        include: {
          token: true,
        },
      })
    )
  );

  // Send notifications and emails (these must be individual)
  for (const assignment of assignmentsWithTokens) {
    const user = userMap.get(assignment.userId)!;
    const tokenRecord = assignment.token!;
    const surveyUrl = getSurveyUrl(tokenRecord.token);

    // Create notification (fire and forget to not block)
    createNotification({
      userId: assignment.userId,
      type: "SURVEY_ASSIGNED",
      title: "New Survey Available",
      message: `We'd love your feedback! Please complete the "${survey.title}" survey.`,
      actionUrl: `/surveys/${tokenRecord.token}`,
      relatedId: assignment.id,
    }).catch((err) => console.error("Failed to create notification:", err));

    // Send email (fire and forget)
    sendSurveyNotification({
      email: user.email,
      userName: user.name || "Volunteer",
      surveyTitle: survey.title,
      surveyUrl,
    }).catch((err) => console.error(`Failed to send survey email to ${user.email}:`, err));

    assigned.push(assignment.userId);
  }

  return { assigned, skipped };
}
