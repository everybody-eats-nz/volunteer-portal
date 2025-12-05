import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { AchievementsStatsSkeleton } from "@/components/achievements-stats-skeleton";
import { AchievementsListSkeleton } from "@/components/achievements-list-skeleton";

export default function AchievementsLoading() {
  return (
    <PageContainer testid="achievements-page">
      <PageHeader
        title="Your Achievements"
        description="Track your volunteer journey and see how you compare with others"
      />

      <AchievementsStatsSkeleton />
      <AchievementsListSkeleton />
    </PageContainer>
  );
}
