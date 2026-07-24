import { PageContainer } from "@/components/page-container";
import { AchievementsPageHeader } from "@/components/achievements-page-header";
import { AchievementsStatsSkeleton } from "@/components/achievements-stats-skeleton";
import { AchievementsListSkeleton } from "@/components/achievements-list-skeleton";

export default function AchievementsLoading() {
  return (
    <PageContainer
      testid="achievements-page"
      className="space-y-12 sm:space-y-16"
    >
      <AchievementsPageHeader />

      <AchievementsStatsSkeleton />
      <AchievementsListSkeleton />
    </PageContainer>
  );
}
