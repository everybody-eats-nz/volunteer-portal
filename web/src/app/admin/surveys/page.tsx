import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
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

  // Aggregate per-status assignment counts for every survey in a single query
  // (avoids an N+1 of four count() calls per survey).
  const statusGroups = await prisma.surveyAssignment.groupBy({
    by: ["surveyId", "status"],
    _count: { _all: true },
  });

  const emptyStats = () => ({
    pending: 0,
    completed: 0,
    dismissed: 0,
    expired: 0,
  });
  const statsBySurvey = new Map<string, ReturnType<typeof emptyStats>>();
  for (const group of statusGroups) {
    const entry = statsBySurvey.get(group.surveyId) ?? emptyStats();
    const key = group.status.toLowerCase() as keyof ReturnType<typeof emptyStats>;
    if (key in entry) entry[key] = group._count._all;
    statsBySurvey.set(group.surveyId, entry);
  }

  const surveysWithStats = surveys.map((survey) => ({
    ...survey,
    stats: {
      totalAssignments: survey._count.assignments,
      ...(statsBySurvey.get(survey.id) ?? emptyStats()),
    },
  }));

  return (
    <PageContainer>
      <SurveysContent initialSurveys={surveysWithStats} />
    </PageContainer>
  );
}
