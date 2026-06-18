import { Suspense } from "react";
import { PageContainer } from "@/components/page-container";
import { ProfilePageHeader } from "@/components/profile-page-header";
import { ProfileContentSkeleton } from "@/components/profile-content-skeleton";
import { ProfileContent } from "./profile-content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profile",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ProfilePage() {
  return (
    <PageContainer testid="profile-page" className="space-y-8">
      <ProfilePageHeader />

      <Suspense fallback={<ProfileContentSkeleton />}>
        <ProfileContent />
      </Suspense>
    </PageContainer>
  );
}
