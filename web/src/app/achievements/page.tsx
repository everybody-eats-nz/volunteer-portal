import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/page-container";
import { AchievementsPageHeader } from "@/components/achievements-page-header";
import { AchievementsStats } from "@/components/achievements-stats";
import { AchievementsList } from "@/components/achievements-list";
import { AchievementsStatsSkeleton } from "@/components/achievements-stats-skeleton";
import { AchievementsListSkeleton } from "@/components/achievements-list-skeleton";
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
    <PageContainer
      testid="achievements-page"
      className="space-y-12 sm:space-y-16"
    >
      <AchievementsPageHeader />

      {/* Stats Overview with Ranking — achievement check runs inside, deduplicated by React cache */}
      <Suspense fallback={<AchievementsStatsSkeleton />}>
        <AchievementsStats userId={userId} />
      </Suspense>

      {/* All Achievements List */}
      <Suspense fallback={<AchievementsListSkeleton />}>
        <AchievementsList userId={userId} />
      </Suspense>
    </PageContainer>
  );
}
