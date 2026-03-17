import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth-options";
import { MotionPageContainer } from "@/components/motion-page-container";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { BarChart3 } from "lucide-react";
import ErrorBoundary from "@/components/error-boundary";
import { FriendsErrorFallback } from "@/components/friends-error-fallback";
import { FriendsContent } from "./friends-content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Friends",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function FriendsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  // Get the tab from searchParams
  const { tab } = await searchParams;
  const initialTab = tab === "requests" ? "requests" : "friends";

  return (
    <MotionPageContainer>
      {/* Header renders immediately */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-2">
        <PageHeader
          title="My Friends"
          description="Manage your friends and discover volunteering opportunities together"
          className="flex-1"
        />
        <div className="flex flex-col sm:flex-row gap-3 w-fit">
          <Button
            asChild
            variant="outline"
            className="w-fit shadow-sm hover:shadow-md transition-shadow"
          >
            <Link href="/friends/stats" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              View Statistics
            </Link>
          </Button>
        </div>
      </div>

      {/* Friends content streams in */}
      <ErrorBoundary fallback={FriendsErrorFallback}>
        <Suspense
          fallback={
            <div className="space-y-6 animate-pulse">
              {/* Search and buttons skeleton */}
              <div className="bg-muted/30 rounded-xl p-8 border">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8">
                  <div className="flex-1 max-w-xl space-y-4">
                    <div className="h-6 bg-muted rounded w-48"></div>
                    <div className="h-10 bg-muted rounded-lg w-full"></div>
                  </div>
                  <div className="flex gap-3">
                    <div className="h-10 bg-muted rounded-md w-36"></div>
                    <div className="h-10 bg-muted rounded-md w-28"></div>
                  </div>
                </div>
              </div>

              {/* Tabs skeleton */}
              <div className="space-y-6">
                <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit">
                  <div className="h-8 bg-background rounded-md w-24"></div>
                  <div className="h-8 bg-transparent rounded-md w-24"></div>
                </div>

                {/* Cards skeleton */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                      key={i}
                      className="bg-card border rounded-lg p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 bg-muted rounded-full"></div>
                          <div className="space-y-2">
                            <div className="h-4 bg-muted rounded w-24"></div>
                            <div className="h-3 bg-muted rounded w-32"></div>
                          </div>
                        </div>
                        <div className="h-8 w-8 bg-muted rounded"></div>
                      </div>
                      <div className="h-9 bg-muted rounded"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          }
        >
          <FriendsContent initialTab={initialTab} />
        </Suspense>
      </ErrorBoundary>
    </MotionPageContainer>
  );
}
