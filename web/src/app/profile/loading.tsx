import { PageContainer } from "@/components/page-container";
import { ProfilePageHeader } from "@/components/profile-page-header";
import { ProfileContentSkeleton } from "@/components/profile-content-skeleton";

export default function ProfileLoading() {
  return (
    <PageContainer className="space-y-8">
      {/* Real header (static content) so the page doesn't jump when data lands */}
      <ProfilePageHeader />
      <ProfileContentSkeleton />
    </PageContainer>
  );
}
