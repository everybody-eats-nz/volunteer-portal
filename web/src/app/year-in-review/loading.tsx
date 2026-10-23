import { PageContainer } from "@/components/page-container";
import { YearInReviewPageHeader } from "@/components/year-in-review/year-in-review-page-header";
import { YearInReviewSkeleton } from "@/components/year-in-review/year-in-review-skeleton";

export default function YearInReviewLoading() {
  return (
    <PageContainer testid="year-in-review-page">
      <YearInReviewPageHeader />
      <YearInReviewSkeleton />
    </PageContainer>
  );
}
