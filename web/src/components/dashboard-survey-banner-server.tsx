import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getOpenSurveyAssignments } from "@/lib/survey-assignments";
import { DashboardSurveyBanner } from "@/components/dashboard-survey-banner";

export async function DashboardSurveyBannerServer() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return null;
  }

  // Only surveys the volunteer hasn't dismissed are shown on the dashboard
  const assignments = await getOpenSurveyAssignments(session.user.id, [
    "PENDING",
  ]);

  if (assignments.length === 0) {
    return null;
  }

  const surveys = assignments.map((assignment) => ({
    id: assignment.id,
    status: assignment.status as "PENDING" | "DISMISSED",
    assignedAt: assignment.assignedAt.toISOString(),
    dismissedAt: assignment.dismissedAt?.toISOString() ?? null,
    survey: assignment.survey,
    token: assignment.token ?? "",
    expiresAt: assignment.expiresAt?.toISOString() ?? "",
  }));

  return <DashboardSurveyBanner initialSurveys={surveys} />;
}
