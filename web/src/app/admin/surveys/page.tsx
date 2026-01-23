import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { SurveysContent } from "./surveys-content";

export default async function SurveysPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const surveys = await prisma.survey.findMany({
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

  // Get stats for each survey
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

  return (
    <AdminPageWrapper title="Surveys">
      <PageContainer>
        <SurveysContent initialSurveys={surveysWithStats} />
      </PageContainer>
    </AdminPageWrapper>
  );
}
