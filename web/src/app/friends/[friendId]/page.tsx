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
            <div className="space-y-12">
              {/* Hero band skeleton */}
              <div className="overflow-hidden rounded-3xl border border-border">
                <div className="flex flex-col items-start gap-6 p-8 sm:flex-row sm:items-center sm:gap-8 sm:p-10">
                  <Skeleton className="h-24 w-24 shrink-0 rounded-full sm:h-28 sm:w-28" />
                  <div className="space-y-3">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-11 w-64" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                </div>
              </div>

              {/* Together bento skeleton */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:grid-rows-2">
                <Skeleton className="col-span-2 row-span-2 min-h-[200px] rounded-3xl" />
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-[92px] rounded-2xl" />
                ))}
              </div>

              {/* Trophy shelf skeleton */}
              <div>
                <div className="mb-5 flex items-center gap-4">
                  <Skeleton className="h-7 w-36" />
                  <Skeleton className="h-px flex-1" />
                </div>
                <Skeleton className="mb-4 h-28 rounded-3xl" />
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Skeleton key={i} className="h-32 rounded-2xl" />
                  ))}
                </div>
              </div>

              {/* Their mahi + shared moments skeleton */}
              <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-8">
                {[1, 2].map((col) => (
                  <div key={col}>
                    <div className="mb-5 flex items-center gap-4">
                      <Skeleton className="h-7 w-36" />
                      <Skeleton className="h-px flex-1" />
                    </div>
                    <Skeleton className="h-24 rounded-2xl" />
                    <Skeleton className="mt-4 h-24 rounded-2xl" />
                  </div>
                ))}
              </div>

              {/* Join them skeleton */}
              <div>
                <div className="mb-5 flex items-center gap-4">
                  <Skeleton className="h-7 w-36" />
                  <Skeleton className="h-px flex-1" />
                </div>
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-[88px] rounded-2xl" />
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
