import { randomBytes } from "crypto";
import { prisma } from "./prisma";
import type { SurveyAssignment, SurveyToken } from "@/generated/client";

/**
 * Generate a secure survey token
 */
export function generateSurveyToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Create and save a survey token for an assignment
 * Tokens never expire by default (expiresAt is null)
 */
export async function createSurveyToken(
  assignmentId: string
): Promise<SurveyToken> {
  const token = generateSurveyToken();

  const surveyToken = await prisma.surveyToken.create({
    data: {
      token,
      assignmentId,
      // expiresAt is omitted (null) - tokens never expire
    },
  });

  return surveyToken;
}

/**
 * Validate a survey token and return the assignment details
 */
export interface ValidateTokenResult {
  valid: boolean;
  message: string;
  assignment?: SurveyAssignment & {
    survey: {
      id: string;
      title: string;
      description: string | null;
      questions: unknown;
      isActive: boolean;
    };
    user: {
      id: string;
      name: string | null;
      email: string;
    };
  };
  token?: SurveyToken;
}

export async function validateSurveyToken(
  token: string
): Promise<ValidateTokenResult> {
  if (!token) {
    return { valid: false, message: "Survey token is required" };
  }

  const surveyToken = await prisma.surveyToken.findUnique({
    where: { token },
    include: {
      assignment: {
        include: {
          survey: {
            select: {
              id: true,
              title: true,
              description: true,
              questions: true,
              isActive: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!surveyToken) {
    return { valid: false, message: "Invalid survey token" };
  }

  // Check if token has expired (only if expiresAt is set)
  if (surveyToken.expiresAt && surveyToken.expiresAt < new Date()) {
    // Update assignment status to expired
    await prisma.surveyAssignment.update({
      where: { id: surveyToken.assignmentId },
      data: { status: "EXPIRED" },
    });
    return { valid: false, message: "Survey token has expired" };
  }

  // Check if token was already used
  if (surveyToken.usedAt) {
    return { valid: false, message: "Survey has already been completed" };
  }

  // Check if assignment is already completed
  if (surveyToken.assignment.status === "COMPLETED") {
    return { valid: false, message: "Survey has already been completed" };
  }

  // Check if survey is still active
  if (!surveyToken.assignment.survey.isActive) {
    return { valid: false, message: "This survey is no longer available" };
  }

  return {
    valid: true,
    message: "Token is valid",
    assignment: surveyToken.assignment,
    token: surveyToken,
  };
}

/**
 * Mark a survey token as used (when survey is submitted)
 */
export async function markTokenAsUsed(token: string): Promise<void> {
  await prisma.surveyToken.update({
    where: { token },
    data: { usedAt: new Date() },
  });
}

/**
 * Get survey URL for a token
 */
export function getSurveyUrl(token: string, baseUrl?: string): string {
  const base = baseUrl || process.env.NEXTAUTH_URL || "http://localhost:3000";
  return `${base}/surveys/${token}`;
}
