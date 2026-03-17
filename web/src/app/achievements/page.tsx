import { Suspense } from "react";
import { cache } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { PageContainer } from "@/components/page-container";
import { AchievementsStats } from "@/components/achievements-stats";
import { AchievementsList } from "@/components/achievements-list";
import { AchievementsStatsSkeleton } from "@/components/achievements-stats-skeleton";
import { AchievementsListSkeleton } from "@/components/achievements-list-skeleton";
import { checkAndUnlockAchievements } from "@/lib/achievements";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Achievements",
  robots: {
    index: false,
    follow: false,
  },
};

// Deduplicate the achievement check across Suspense boundaries within the same request
const checkAchievementsOnce = cache(async (userId: string) => {
  await checkAndUnlockAchievements(userId);
});

export default async function AchievementsPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login?callbackUrl=/achievements");
  }

  // Run achievement check once — cached so both children won't re-run it
  await checkAchievementsOnce(userId);

  return (
    <PageContainer testid="achievements-page">
      <PageHeader
        title="Your Achievements"
        description="Track your volunteer journey and see how you compare with others"
      />

      {/* Stats Overview with Ranking */}
      <Suspense fallback={<AchievementsStatsSkeleton />}>
        <AchievementsStats userId={userId} skipUnlockCheck />
      </Suspense>

      {/* All Achievements List */}
      <Suspense fallback={<AchievementsListSkeleton />}>
        <AchievementsList userId={userId} skipUnlockCheck />
      </Suspense>
    </PageContainer>
  );
}
