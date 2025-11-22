import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { AchievementsContent } from "./achievements-content";

export default async function AchievementsPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const achievements = await prisma.achievement.findMany({
    include: {
      _count: {
        select: {
          users: true,
        },
      },
    },
    orderBy: [{ category: "asc" }, { points: "asc" }],
  });

  return (
    <AdminPageWrapper title="Achievements">
      <PageContainer>
        <AchievementsContent initialAchievements={achievements} />
      </PageContainer>
    </AdminPageWrapper>
  );
}
