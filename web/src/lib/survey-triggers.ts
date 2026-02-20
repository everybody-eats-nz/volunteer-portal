import { prisma } from "./prisma";
import { calculateUserProgress, type UserProgress } from "./achievements";
import { createSurveyToken, generateSurveyToken, getSurveyUrl } from "./survey-tokens";
import { createNotification } from "./notifications";
import { sendSurveyNotification } from "./email-service";
import { Prisma, type SurveyTriggerType } from "@/generated/client";
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
              // expiresAt omitted - tokens never expire
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

export interface BulkEligibilityResult {
  eligibleUserIds: string[];
  totalEligible: number;
  alreadyAssigned: number;
  sampleUsers: { id: string; name: string | null; email: string }[];
}

/**
 * Find all users eligible for a survey using efficient bulk DB queries.
 * Unlike per-user `calculateUserProgress`, this uses aggregate queries
 * to find all matching users at once.
 */
export async function findEligibleUsersForSurvey(
  surveyId: string
): Promise<BulkEligibilityResult> {
  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
  });

  if (!survey) {
    throw new Error("Survey not found");
  }

  // Get users already assigned to this survey
  const existingAssignments = await prisma.surveyAssignment.findMany({
    where: { surveyId },
    select: { userId: true },
  });
  const alreadyAssignedIds = new Set(existingAssignments.map((a) => a.userId));

  let candidateUserIds: string[];

  switch (survey.triggerType) {
    case "SHIFTS_COMPLETED": {
      // Users with completed shift count in range [triggerValue, triggerMaxValue]
      const maxCondition = survey.triggerMaxValue !== null
        ? Prisma.sql`AND COUNT(DISTINCT s.id) <= ${survey.triggerMaxValue}`
        : Prisma.empty;

      const rows = await prisma.$queryRaw<Array<{ userId: string }>>`
        SELECT s."userId"
        FROM "Signup" s
        JOIN "Shift" sh ON sh.id = s."shiftId"
        WHERE s.status = 'CONFIRMED'
          AND sh."end" < NOW()
        GROUP BY s."userId"
        HAVING COUNT(DISTINCT s.id) >= ${survey.triggerValue}
          ${maxCondition}
      `;
      candidateUserIds = rows.map((r) => r.userId);
      break;
    }

    case "HOURS_VOLUNTEERED": {
      // Users with total hours in range [triggerValue, triggerMaxValue]
      const maxCondition = survey.triggerMaxValue !== null
        ? Prisma.sql`AND SUM(EXTRACT(EPOCH FROM (sh."end" - sh.start)) / 3600) <= ${survey.triggerMaxValue}`
        : Prisma.empty;

      const rows = await prisma.$queryRaw<Array<{ userId: string }>>`
        SELECT s."userId"
        FROM "Signup" s
        JOIN "Shift" sh ON sh.id = s."shiftId"
        WHERE s.status = 'CONFIRMED'
          AND sh."end" < NOW()
        GROUP BY s."userId"
        HAVING SUM(EXTRACT(EPOCH FROM (sh."end" - sh.start)) / 3600) >= ${survey.triggerValue}
          ${maxCondition}
      `;
      candidateUserIds = rows.map((r) => r.userId);
      break;
    }

    case "FIRST_SHIFT": {
      // Users whose first completed shift was [triggerValue, triggerMaxValue] days ago
      const maxCondition = survey.triggerMaxValue !== null
        ? Prisma.sql`AND EXTRACT(EPOCH FROM (NOW() - MIN(sh.start))) / 86400 <= ${survey.triggerMaxValue}`
        : Prisma.empty;

      const rows = await prisma.$queryRaw<Array<{ userId: string }>>`
        SELECT s."userId"
        FROM "Signup" s
        JOIN "Shift" sh ON sh.id = s."shiftId"
        WHERE s.status = 'CONFIRMED'
          AND sh."end" < NOW()
        GROUP BY s."userId"
        HAVING EXTRACT(EPOCH FROM (NOW() - MIN(sh.start))) / 86400 >= ${survey.triggerValue}
          ${maxCondition}
      `;
      candidateUserIds = rows.map((r) => r.userId);
      break;
    }

    case "MANUAL": {
      // All VOLUNTEER-role users
      const rows = await prisma.user.findMany({
        where: { role: "VOLUNTEER" },
        select: { id: true },
      });
      candidateUserIds = rows.map((r) => r.id);
      break;
    }

    default:
      candidateUserIds = [];
  }

  // Exclude already-assigned users
  const eligibleUserIds = candidateUserIds.filter(
    (id) => !alreadyAssignedIds.has(id)
  );

  // Fetch sample users for preview (up to 10)
  const sampleUsers = eligibleUserIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: eligibleUserIds.slice(0, 10) } },
        select: { id: true, name: true, email: true },
      })
    : [];

  return {
    eligibleUserIds,
    totalEligible: eligibleUserIds.length,
    alreadyAssigned: alreadyAssignedIds.size,
    sampleUsers,
  };
}
