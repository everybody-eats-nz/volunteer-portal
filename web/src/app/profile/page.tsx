import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { PageContainer } from "@/components/page-container";
import { ProfileContent } from "./profile-content";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
    <PageContainer testid="profile-page">
      <PageHeader
        title="Your Profile"
        description="Manage your volunteer account and track your impact"
      />

      <Suspense fallback={<ProfileContentSkeleton />}>
        <ProfileContent />
      </Suspense>
    </PageContainer>
  );
}

function ProfileContentSkeleton() {
  return (
    <div className="space-y-8">
      {/* Profile header card */}
      <Card>
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            <Skeleton className="h-36 w-36 rounded-full" />
            <div className="flex-1 space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-24" />
              </div>
            </div>
            <Skeleton className="h-9 w-28" />
          </div>
        </CardContent>
      </Card>

      {/* Detail cards grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {[1, 2, 3].map((j) => (
                <div key={j} className="flex justify-between items-center py-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
