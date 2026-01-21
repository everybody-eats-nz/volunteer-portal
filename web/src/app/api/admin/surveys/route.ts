import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import type { SurveyTriggerType } from "@/generated/client";
import type { CreateSurveyInput } from "@/types/survey";

// GET /api/admin/surveys - List all surveys
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    const surveys = await prisma.survey.findMany({
      where: includeInactive ? undefined : { isActive: true },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            assignments: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get response counts for each survey
    const surveysWithStats = await Promise.all(
      surveys.map(async (survey) => {
        const [pending, completed, dismissed, expired] = await Promise.all([
          prisma.surveyAssignment.count({
            where: { surveyId: survey.id, status: "PENDING" },
          }),
          prisma.surveyAssignment.count({
            where: { surveyId: survey.id, status: "COMPLETED" },
          }),
          prisma.surveyAssignment.count({
            where: { surveyId: survey.id, status: "DISMISSED" },
          }),
          prisma.surveyAssignment.count({
            where: { surveyId: survey.id, status: "EXPIRED" },
          }),
        ]);

        return {
          ...survey,
          stats: {
            totalAssignments: survey._count.assignments,
            pending,
            completed,
            dismissed,
            expired,
          },
        };
      })
    );

    return NextResponse.json(surveysWithStats);
  } catch (error) {
    console.error("Error fetching surveys:", error);
    return NextResponse.json(
      { error: "Failed to fetch surveys" },
      { status: 500 }
    );
  }
}

// POST /api/admin/surveys - Create a new survey
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body: CreateSurveyInput = await request.json();

    // Validate required fields
    if (!body.title || !body.title.trim()) {
      return NextResponse.json(
        { error: "Survey title is required" },
        { status: 400 }
      );
    }

    if (!body.questions || body.questions.length === 0) {
      return NextResponse.json(
        { error: "At least one question is required" },
        { status: 400 }
      );
    }

    if (!body.triggerType) {
      return NextResponse.json(
        { error: "Trigger type is required" },
        { status: 400 }
      );
    }

    if (body.triggerType !== "MANUAL" && (body.triggerValue === undefined || body.triggerValue < 0)) {
      return NextResponse.json(
        { error: "Trigger value is required for non-manual surveys" },
        { status: 400 }
      );
    }

    // Validate questions
    for (const question of body.questions) {
      if (!question.id || !question.text || !question.type) {
        return NextResponse.json(
          { error: "Each question must have an id, text, and type" },
          { status: 400 }
        );
      }

      // Validate multiple choice questions have options
      if (
        (question.type === "multiple_choice_single" ||
          question.type === "multiple_choice_multi") &&
        (!question.options || question.options.length < 2)
      ) {
        return NextResponse.json(
          { error: "Multiple choice questions must have at least 2 options" },
          { status: 400 }
        );
      }

      // Validate rating scale has proper min/max
      if (question.type === "rating_scale") {
        const min = question.minValue ?? 1;
        const max = question.maxValue ?? 5;
        if (min >= max) {
          return NextResponse.json(
            { error: "Rating scale max must be greater than min" },
            { status: 400 }
          );
        }
      }
    }

    // Get the creator user ID
    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const survey = await prisma.survey.create({
      data: {
        title: body.title.trim(),
        description: body.description?.trim() || null,
        questions: body.questions as unknown as object[],
        triggerType: body.triggerType as SurveyTriggerType,
        triggerValue: body.triggerValue ?? 0,
        isActive: body.isActive ?? true,
        createdBy: user.id,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(survey, { status: 201 });
  } catch (error) {
    console.error("Error creating survey:", error);
    return NextResponse.json(
      { error: "Failed to create survey" },
      { status: 500 }
    );
  }
}
