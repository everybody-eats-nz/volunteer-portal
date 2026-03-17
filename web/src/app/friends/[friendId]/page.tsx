import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth-options";
import { MotionPageContainer } from "@/components/motion-page-container";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { FriendProfileContent } from "./friend-profile-content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Friend Profile",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function FriendProfilePage({
  params,
}: {
  params: Promise<{ friendId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login?callbackUrl=/friends");
  }

  const { friendId } = await params;

  return (
    <MotionPageContainer testid="friend-profile-page">
      <div className="space-y-8">
        {/* Header with back button renders immediately */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild className="hover:bg-accent/50">
            <Link href="/friends" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to Friends</span>
              <span className="sm:hidden">Back</span>
            </Link>
          </Button>
        </div>

        {/* Friend profile content streams in */}
        <Suspense
          fallback={
            <div className="space-y-8">
              {/* Profile header skeleton */}
              <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-muted/10 shadow-md">
                <div className="p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
                  <Skeleton className="h-24 w-24 sm:h-28 sm:w-28 rounded-full" />
                  <div className="flex-1 space-y-3">
                    <div>
                      <Skeleton className="h-10 w-56 mb-2" />
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-4 w-36" />
                        <Skeleton className="h-4 w-28 hidden sm:block" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Skeleton className="h-6 w-24 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats grid skeleton */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="bg-card border rounded-xl p-5 space-y-3"
                  >
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                ))}
              </div>

              {/* Two-column card layout skeleton */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                {/* Activity card skeleton */}
                <div className="bg-card border rounded-xl overflow-hidden">
                  <div className="p-6 pb-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-xl" />
                      <Skeleton className="h-6 w-44" />
                    </div>
                  </div>
                  <div className="px-6 pb-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-5 bg-muted/20 rounded-xl border">
                        <Skeleton className="h-10 w-12 mb-2" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                      <div className="p-5 bg-muted/20 rounded-xl border">
                        <Skeleton className="h-10 w-12 mb-2" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                    <div className="p-5 bg-muted/20 rounded-xl border text-center">
                      <Skeleton className="h-6 w-28 mx-auto mb-3" />
                      <Skeleton className="h-6 w-36 mx-auto mb-1" />
                      <Skeleton className="h-4 w-28 mx-auto" />
                    </div>
                  </div>
                </div>

                {/* Shared volunteering card skeleton */}
                <div className="bg-card border rounded-xl overflow-hidden">
                  <div className="p-6 pb-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-xl" />
                      <Skeleton className="h-6 w-44" />
                    </div>
                  </div>
                  <div className="px-6 pb-6 space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className="flex items-center gap-4 p-4 rounded-xl"
                      >
                        <Skeleton className="w-3 h-3 rounded-full" />
                        <div className="flex-1 min-w-0">
                          <Skeleton className="h-4 w-32 mb-1" />
                          <Skeleton className="h-3 w-40" />
                        </div>
                        <Skeleton className="h-5 w-20 rounded-full" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Upcoming shifts skeleton */}
              <div className="bg-card border rounded-xl">
                <div className="p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-xl" />
                      <Skeleton className="h-6 w-52" />
                    </div>
                    <Skeleton className="h-9 w-28" />
                  </div>
                </div>
                <div className="px-6 pb-6 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex items-center gap-4 p-4 border border-border rounded-xl"
                    >
                      <Skeleton className="w-14 h-14 rounded-xl" />
                      <div className="flex-1 min-w-0">
                        <Skeleton className="h-5 w-36 mb-1" />
                        <Skeleton className="h-4 w-28" />
                      </div>
                      <div className="text-right">
                        <Skeleton className="h-4 w-16 mb-1" />
                        <Skeleton className="h-3 w-14" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          }
        >
          <FriendProfileContent friendId={friendId} />
        </Suspense>
      </div>
    </MotionPageContainer>
  );
}
