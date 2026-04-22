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
  searchParams: Promise<{
    location?: string;
    grade?: string;
    tenure?: string;
    shifts?: string;
  }>;
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
  const { location, grade, tenure, shifts } = await searchParams;

  // Fetch available locations for the filter
  const locations = await prisma.location.findMany({
    where: { isActive: true },
    select: { name: true },
    orderBy: { name: "asc" },
  });
  const locationOptions = locations.map((l) => l.name);

  // Build user filter from query params
  const userWhere: Record<string, unknown> = {};
  if (location) {
    userWhere.defaultLocation = location;
  }
  if (grade) {
    userWhere.volunteerGrade = grade;
  }
  if (tenure) {
    const now = new Date();
    const monthsAgo = (months: number) => {
      const d = new Date(now);
      d.setMonth(d.getMonth() - months);
      return d;
    };
    switch (tenure) {
      case "lt1m":
        userWhere.createdAt = { gt: monthsAgo(1) };
        break;
      case "1-3m":
        userWhere.createdAt = { gte: monthsAgo(3), lt: monthsAgo(1) };
        break;
      case "3-6m":
        userWhere.createdAt = { gte: monthsAgo(6), lt: monthsAgo(3) };
        break;
      case "6-12m":
        userWhere.createdAt = { gte: monthsAgo(12), lt: monthsAgo(6) };
        break;
      case "gt1y":
        userWhere.createdAt = { lt: monthsAgo(12) };
        break;
    }
  }

  // Fetch survey with all assignments
  const survey = await prisma.survey.findUnique({
    where: { id },
    include: {
      assignments: {
        where: {
          ...(Object.keys(userWhere).length > 0 && { user: userWhere }),
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              defaultLocation: true,
              createdAt: true,
              volunteerGrade: true,
              completedShiftAdjustment: true,
              _count: {
                select: {
                  signups: {
                    where: {
                      status: "CONFIRMED",
                      shift: { start: { lt: new Date() } },
                    },
                  },
                },
              },
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

  // Apply shifts filter post-query (requires calculated count)
  let filteredAssignments = survey.assignments;
  if (shifts) {
    filteredAssignments = filteredAssignments.filter((a) => {
      const count =
        a.user._count.signups + (a.user.completedShiftAdjustment || 0);
      switch (shifts) {
        case "0-5":
          return count <= 5;
        case "6-15":
          return count >= 6 && count <= 15;
        case "16-30":
          return count >= 16 && count <= 30;
        case "31-50":
          return count >= 31 && count <= 50;
        case "gt50":
          return count > 50;
        default:
          return true;
      }
    });
  }

  // Separate completed assignments for stats calculation
  const completedAssignments = filteredAssignments.filter(
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
              id: a.user.id,
              name: a.user.name,
              email: a.user.email,
              defaultLocation: a.user.defaultLocation,
              createdAt: a.user.createdAt,
              volunteerGrade: a.user.volunteerGrade,
              completedShifts:
                a.user._count.signups +
                (a.user.completedShiftAdjustment || 0),
            },
            completedAt: a.completedAt,
            answers: a.response?.answers as
              | Array<{
                  questionId: string;
                  value: string | string[] | number | boolean | null;
                }>
              | undefined,
          }))}
          assignments={filteredAssignments.map((a) => ({
            id: a.id,
            status: a.status,
            assignedAt: a.assignedAt,
            completedAt: a.completedAt,
            dismissedAt: a.dismissedAt,
            user: {
              id: a.user.id,
              name: a.user.name,
              email: a.user.email,
              defaultLocation: a.user.defaultLocation,
              createdAt: a.user.createdAt,
              volunteerGrade: a.user.volunteerGrade,
              completedShifts:
                a.user._count.signups +
                (a.user.completedShiftAdjustment || 0),
            },
          }))}
          locations={locationOptions}
          selectedLocation={location}
          selectedGrade={grade}
          selectedTenure={tenure}
          selectedShifts={shifts}
        />
      </PageContainer>
    </AdminPageWrapper>
  );
}
