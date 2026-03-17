import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { DashboardSurveyBanner } from "@/components/dashboard-survey-banner";

export async function DashboardSurveyBannerServer() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return null;
  }

  // Fetch pending survey assignments server-side (mirrors /api/surveys/pending)
  const assignments = await prisma.surveyAssignment.findMany({
    where: {
      userId: session.user.id,
      status: "PENDING",
      survey: { isActive: true },
    },
    include: {
      survey: {
        select: {
          id: true,
          title: true,
          description: true,
        },
      },
      token: {
        select: {
          token: true,
          expiresAt: true,
        },
      },
    },
    orderBy: { assignedAt: "desc" },
  });

  if (assignments.length === 0) {
    return null;
  }

  const surveys = assignments.map((assignment) => ({
    id: assignment.id,
    status: assignment.status as "PENDING" | "DISMISSED",
    assignedAt: assignment.assignedAt.toISOString(),
    dismissedAt: assignment.dismissedAt?.toISOString() ?? null,
    survey: assignment.survey,
    token: assignment.token?.token ?? "",
    expiresAt: assignment.token?.expiresAt?.toISOString() ?? "",
  }));

  return <DashboardSurveyBanner initialSurveys={surveys} />;
}
