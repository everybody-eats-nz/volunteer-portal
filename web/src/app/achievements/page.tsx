import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { PageContainer } from "@/components/page-container";
import { AchievementsStats } from "@/components/achievements-stats";
import { AchievementsList } from "@/components/achievements-list";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Achievements",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AchievementsPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login?callbackUrl=/achievements");
  }

  return (
    <PageContainer testid="achievements-page">
      <PageHeader
        title="Your Achievements"
        description="Track your volunteer journey and see how you compare with others"
      />

      {/* Stats Overview with Ranking */}
      <AchievementsStats userId={userId} />

      {/* All Achievements List */}
      <AchievementsList userId={userId} />
    </PageContainer>
  );
}
