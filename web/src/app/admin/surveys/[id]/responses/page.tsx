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
}

export default async function SurveyResponsesPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const { id } = await params;

  const survey = await prisma.survey.findUnique({
    where: { id },
    include: {
      assignments: {
        where: { status: "COMPLETED" },
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
      },
    },
  });

  if (!survey) {
    notFound();
  }

  // Calculate stats for each question
  const questions = survey.questions as unknown as SurveyQuestion[];

  const questionStats = questions.map((question) => {
    const responses = survey.assignments
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
          totalResponses={survey.assignments.length}
          questionStats={questionStats}
          responses={survey.assignments.map((a) => ({
            id: a.id,
            user: a.user,
            completedAt: a.completedAt,
            answers: a.response?.answers as
              | Array<{
                  questionId: string;
                  value: string | string[] | number | boolean | null;
                }>
              | undefined,
          }))}
        />
      </PageContainer>
    </AdminPageWrapper>
  );
}
