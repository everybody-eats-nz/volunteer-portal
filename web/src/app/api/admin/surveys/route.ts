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

    // Get all assignment stats in a single query using groupBy
    const surveyIds = surveys.map((s) => s.id);
    const assignmentStats = await prisma.surveyAssignment.groupBy({
      by: ["surveyId", "status"],
      where: { surveyId: { in: surveyIds } },
      _count: { id: true },
    });

    // Build a map of surveyId -> status -> count
    const statsMap = new Map<string, Record<string, number>>();
    for (const stat of assignmentStats) {
      if (!statsMap.has(stat.surveyId)) {
        statsMap.set(stat.surveyId, { PENDING: 0, COMPLETED: 0, DISMISSED: 0, EXPIRED: 0 });
      }
      statsMap.get(stat.surveyId)![stat.status] = stat._count.id;
    }

    // Combine surveys with their stats
    const surveysWithStats = surveys.map((survey) => {
      const stats = statsMap.get(survey.id) || { PENDING: 0, COMPLETED: 0, DISMISSED: 0, EXPIRED: 0 };
      return {
        ...survey,
        stats: {
          totalAssignments: survey._count.assignments,
          pending: stats.PENDING,
          completed: stats.COMPLETED,
          dismissed: stats.DISMISSED,
          expired: stats.EXPIRED,
        },
      };
    });

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

    // Validate triggerMaxValue if provided
    if (body.triggerMaxValue !== undefined && body.triggerMaxValue !== null) {
      if (body.triggerMaxValue < 0) {
        return NextResponse.json(
          { error: "Maximum threshold cannot be negative" },
          { status: 400 }
        );
      }
      if (body.triggerMaxValue < body.triggerValue) {
        return NextResponse.json(
          { error: "Maximum threshold must be greater than or equal to minimum threshold" },
          { status: 400 }
        );
      }
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
        triggerMaxValue: body.triggerMaxValue ?? null,
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
