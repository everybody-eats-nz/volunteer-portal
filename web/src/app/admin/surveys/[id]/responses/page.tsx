import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect, notFound } from "next/navigation";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { ResponsesContent } from "./responses-content";
import type { SurveyQuestion } from "@/types/survey";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ location?: string }>;
}

export default async function SurveyResponsesPage({
  params,
  searchParams,
}: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const { id } = await params;
  const { location } = await searchParams;

  // Fetch available locations for the filter
  const locations = await prisma.location.findMany({
    where: { isActive: true },
    select: { name: true },
    orderBy: { name: "asc" },
  });
  const locationOptions = locations.map((l) => l.name);

  // Fetch survey with all assignments
  const survey = await prisma.survey.findUnique({
    where: { id },
    include: {
      assignments: {
        where: {
          // Filter by user's available locations if a location is selected
          ...(location && {
            user: {
              availableLocations: {
                contains: location,
                mode: "insensitive",
              },
            },
          }),
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              availableLocations: true,
            },
          },
          response: true,
        },
        orderBy: { assignedAt: "desc" },
      },
    },
  });

  if (!survey) {
    notFound();
  }

  // Separate completed assignments for stats calculation
  const completedAssignments = survey.assignments.filter(
    (a) => a.status === "COMPLETED"
  );

  // Calculate stats for each question
  const questions = survey.questions as unknown as SurveyQuestion[];

  const questionStats = questions.map((question) => {
    const responses = completedAssignments
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
      const distribution: Record<string, number> = {};
      responses.forEach((value) => {
        const key = String(value);
        distribution[key] = (distribution[key] || 0) + 1;
      });
      stats.distribution = distribution;
    } else if (question.type === "multiple_choice_multi") {
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
      const numericResponses = responses
        .map((v) => Number(v))
        .filter((n) => !isNaN(n));
      if (numericResponses.length > 0) {
        stats.average =
          numericResponses.reduce((sum, n) => sum + n, 0) /
          numericResponses.length;
      }
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
      stats.textResponses = responses
        .map((v) => String(v))
        .filter((v) => v.trim())
        .slice(0, 100);
    }

    return stats;
  });

  return (
    <AdminPageWrapper title={`Survey Responses: ${survey.title}`}>
      <PageContainer>
        <ResponsesContent
          survey={{
            id: survey.id,
            title: survey.title,
            description: survey.description,
            questions: questions,
          }}
          totalResponses={completedAssignments.length}
          questionStats={questionStats}
          responses={completedAssignments.map((a) => ({
            id: a.id,
            user: {
              ...a.user,
              availableLocations: a.user.availableLocations,
            },
            completedAt: a.completedAt,
            answers: a.response?.answers as
              | Array<{
                  questionId: string;
                  value: string | string[] | number | boolean | null;
                }>
              | undefined,
          }))}
          assignments={survey.assignments.map((a) => ({
            id: a.id,
            status: a.status,
            assignedAt: a.assignedAt,
            completedAt: a.completedAt,
            dismissedAt: a.dismissedAt,
            user: {
              id: a.user.id,
              name: a.user.name,
              email: a.user.email,
              availableLocations: a.user.availableLocations,
            },
          }))}
          locations={locationOptions}
          selectedLocation={location}
        />
      </PageContainer>
    </AdminPageWrapper>
  );
}
