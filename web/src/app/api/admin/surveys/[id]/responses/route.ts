import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/surveys/[id]/responses - Get all responses for a survey
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const includeAllAssignments = searchParams.get("includeAll") === "true";

    // Check if survey exists
    const survey = await prisma.survey.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        questions: true,
      },
    });

    if (!survey) {
      return NextResponse.json(
        { error: "Survey not found" },
        { status: 404 }
      );
    }

    // Get assignments - either all or just completed based on query param
    const assignments = await prisma.surveyAssignment.findMany({
      where: {
        surveyId: id,
        ...(includeAllAssignments ? {} : { status: "COMPLETED" }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        response: true,
      },
      orderBy: { completedAt: "desc" },
    });

    // Calculate aggregate statistics for each question
    const questions = survey.questions as Array<{
      id: string;
      type: string;
      text: string;
      options?: string[];
      minValue?: number;
      maxValue?: number;
    }>;

    const questionStats = questions.map((question) => {
      const responses = assignments
        .filter((a) => a.response)
        .map((a) => {
          const answers = a.response!.answers as Array<{
            questionId: string;
            value: string | string[] | number | boolean | null;
          }>;
          return answers.find((ans) => ans.questionId === question.id)?.value;
        })
        .filter((v) => v !== undefined && v !== null);

      const stats: {
        questionId: string;
        questionText: string;
        questionType: string;
        totalResponses: number;
        distribution?: Record<string, number>;
        average?: number;
        textResponses?: string[];
      } = {
        questionId: question.id,
        questionText: question.text,
        questionType: question.type,
        totalResponses: responses.length,
      };

      if (
        question.type === "multiple_choice_single" ||
        question.type === "yes_no"
      ) {
        // Count distribution for single choice
        const distribution: Record<string, number> = {};
        responses.forEach((value) => {
          const key = String(value);
          distribution[key] = (distribution[key] || 0) + 1;
        });
        stats.distribution = distribution;
      } else if (question.type === "multiple_choice_multi") {
        // Count distribution for multi-choice
        const distribution: Record<string, number> = {};
        responses.forEach((value) => {
          const values = Array.isArray(value) ? value : [value];
          values.forEach((v) => {
            const key = String(v);
            distribution[key] = (distribution[key] || 0) + 1;
          });
        });
        stats.distribution = distribution;
      } else if (question.type === "rating_scale") {
        // Calculate average for rating
        const numericResponses = responses
          .map((v) => Number(v))
          .filter((n) => !isNaN(n));
        if (numericResponses.length > 0) {
          stats.average =
            numericResponses.reduce((sum, n) => sum + n, 0) /
            numericResponses.length;
        }
        // Also include distribution
        const distribution: Record<string, number> = {};
        numericResponses.forEach((value) => {
          const key = String(value);
          distribution[key] = (distribution[key] || 0) + 1;
        });
        stats.distribution = distribution;
      } else if (
        question.type === "text_short" ||
        question.type === "text_long"
      ) {
        // Collect text responses (limited to avoid large payloads)
        stats.textResponses = responses
          .map((v) => String(v))
          .filter((v) => v.trim())
          .slice(0, 100);
      }

      return stats;
    });

    return NextResponse.json({
      survey: {
        id: survey.id,
        title: survey.title,
        questions: survey.questions,
      },
      totalResponses: assignments.filter((a) => a.status === "COMPLETED").length,
      questionStats,
      responses: assignments
        .filter((a) => a.status === "COMPLETED")
        .map((a) => ({
          id: a.id,
          user: a.user,
          completedAt: a.completedAt,
          answers: a.response?.answers,
        })),
      // Include all assignments when requested (for the assign dialog)
      ...(includeAllAssignments && {
        assignments: assignments.map((a) => ({
          id: a.id,
          userId: a.userId,
          status: a.status,
          user: a.user,
        })),
      }),
    });
  } catch (error) {
    console.error("Error fetching survey responses:", error);
    return NextResponse.json(
      { error: "Failed to fetch survey responses" },
      { status: 500 }
    );
  }
}
