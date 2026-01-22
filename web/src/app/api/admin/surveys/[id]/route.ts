import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import type { SurveyTriggerType } from "@/generated/client";
import type { UpdateSurveyInput } from "@/types/survey";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/surveys/[id] - Get a single survey
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = await params;

    const survey = await prisma.survey.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            response: true,
            token: {
              select: {
                token: true,
                expiresAt: true,
                usedAt: true,
              },
            },
          },
          orderBy: { assignedAt: "desc" },
        },
      },
    });

    if (!survey) {
      return NextResponse.json(
        { error: "Survey not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(survey);
  } catch (error) {
    console.error("Error fetching survey:", error);
    return NextResponse.json(
      { error: "Failed to fetch survey" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/surveys/[id] - Update a survey
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body: UpdateSurveyInput = await request.json();

    // Check if survey exists
    const existingSurvey = await prisma.survey.findUnique({
      where: { id },
    });

    if (!existingSurvey) {
      return NextResponse.json(
        { error: "Survey not found" },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: {
      title?: string;
      description?: string | null;
      questions?: object[];
      triggerType?: SurveyTriggerType;
      triggerValue?: number;
      triggerMaxValue?: number | null;
      isActive?: boolean;
    } = {};

    if (body.title !== undefined) {
      if (!body.title.trim()) {
        return NextResponse.json(
          { error: "Survey title cannot be empty" },
          { status: 400 }
        );
      }
      updateData.title = body.title.trim();
    }

    if (body.description !== undefined) {
      updateData.description = body.description?.trim() || null;
    }

    if (body.questions !== undefined) {
      if (body.questions.length === 0) {
        return NextResponse.json(
          { error: "At least one question is required" },
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

      updateData.questions = body.questions as unknown as object[];
    }

    if (body.triggerType !== undefined) {
      updateData.triggerType = body.triggerType as SurveyTriggerType;
    }

    if (body.triggerValue !== undefined) {
      updateData.triggerValue = body.triggerValue;
    }

    // Handle triggerMaxValue - can be set, cleared (null), or left unchanged
    if ("triggerMaxValue" in body) {
      const maxValue = body.triggerMaxValue;
      const minValue = body.triggerValue ?? existingSurvey.triggerValue;

      if (maxValue !== null && maxValue !== undefined) {
        if (maxValue < 0) {
          return NextResponse.json(
            { error: "Maximum threshold cannot be negative" },
            { status: 400 }
          );
        }
        if (maxValue < minValue) {
          return NextResponse.json(
            { error: "Maximum threshold must be greater than or equal to minimum threshold" },
            { status: 400 }
          );
        }
      }
      updateData.triggerMaxValue = maxValue ?? null;
    }

    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive;
    }

    const survey = await prisma.survey.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json(survey);
  } catch (error) {
    console.error("Error updating survey:", error);
    return NextResponse.json(
      { error: "Failed to update survey" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/surveys/[id] - Delete a survey
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = await params;

    // Check if survey exists
    const existingSurvey = await prisma.survey.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            assignments: true,
          },
        },
      },
    });

    if (!existingSurvey) {
      return NextResponse.json(
        { error: "Survey not found" },
        { status: 404 }
      );
    }

    // If survey has assignments, just deactivate it instead of deleting
    if (existingSurvey._count.assignments > 0) {
      await prisma.survey.update({
        where: { id },
        data: { isActive: false },
      });

      return NextResponse.json({
        message: "Survey deactivated (has existing assignments)",
        deactivated: true,
      });
    }

    // Otherwise, delete the survey
    await prisma.survey.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Survey deleted", deleted: true });
  } catch (error) {
    console.error("Error deleting survey:", error);
    return NextResponse.json(
      { error: "Failed to delete survey" },
      { status: 500 }
    );
  }
}
