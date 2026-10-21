import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth-options";
import { PageContainer } from "@/components/page-container";
import { BarChart3 } from "lucide-react";
import ErrorBoundary from "@/components/error-boundary";
import { FriendsErrorFallback } from "@/components/friends-error-fallback";
import { FriendsContent } from "./friends-content";
import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Friends",
  robots: {
    index: false,
    follow: false,
  },
};

/* Pill links — shared brand system with the marketing site
   (marketing-cms STYLEGUIDE.md: btn-primary / btn-ghost). */
const pillGhost =
  "inline-flex items-center justify-center gap-2 rounded-full border border-forest-500/30 px-6 py-3 text-sm font-medium text-forest-700 transition-all duration-200 hover:bg-forest-700 hover:text-cream-50 hover:border-forest-700 dark:border-cream-50/30 dark:text-cream-50 dark:hover:bg-cream-50 dark:hover:text-forest-700";

/** Loading skeleton mirroring the redesigned layout: toolbar, pill tabs,
    card grid and the dark suggestions panel. */
function FriendsSkeleton() {
  return (
    <div className="animate-pulse space-y-10" aria-hidden>
      {/* Toolbar: search + actions */}
      <div className="rounded-[2rem] border border-forest-500/10 bg-card p-5 sm:p-6 dark:border-cream-50/10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="h-11 w-full max-w-md rounded-full bg-forest-500/10 dark:bg-cream-50/10" />
          <div className="flex gap-3">
            <div className="h-11 w-40 rounded-full bg-forest-500/10 dark:bg-cream-50/10" />
            <div className="h-11 w-32 rounded-full bg-forest-500/15 dark:bg-cream-50/15" />
          </div>
        </div>
      </div>

      {/* Pill tabs */}
      <div className="flex gap-2">
        <div className="h-11 w-32 rounded-full bg-forest-500/15 dark:bg-cream-50/15" />
        <div className="h-11 w-32 rounded-full bg-forest-500/10 dark:bg-cream-50/10" />
      </div>

      {/* Friend cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="rounded-3xl border border-forest-500/10 bg-card p-5 dark:border-cream-50/10"
          >
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-forest-500/10 dark:bg-cream-50/10" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-28 rounded-full bg-forest-500/10 dark:bg-cream-50/10" />
                <div className="h-3 w-36 rounded-full bg-forest-500/10 dark:bg-cream-50/10" />
              </div>
            </div>
            <div className="mt-5 h-10 rounded-full bg-forest-500/10 dark:bg-cream-50/10" />
          </div>
        ))}
      </div>

      {/* Suggestions panel */}
      <div className="h-64 rounded-[2rem] bg-forest-700/90" />
    </div>
  );
}

export default function FriendsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  // Suspense boundary: the session check and `tab` search param below are
  // uncached, per-request data. Under cacheComponents (next.config), a
  // route that reads them with no boundary to bail into can intermittently
  // throw "encountered uncached data during prerendering or a navigation"
  // during the shell/prefetch pass — surfacing as flaky e2e failures under
  // concurrent load. Mirrors the pattern already used in the root layout
  // (src/app/layout.tsx) and now the admin layout.
  return (
    <Suspense>
      <FriendsPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function FriendsPageContent({
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
    <PageContainer testid="friends-page">
      <PageHeader
        title={
          <>
            My <em>Friends</em>
          </>
        }
        description="Volunteering is better together — keep up with the people you meet on the mahi."
        className="pb-8"
        actions={
          <Link
            href="/friends/stats"
            className={`${pillGhost} w-fit`}
            data-testid="view-statistics-link"
          >
            <BarChart3 className="h-4 w-4" aria-hidden />
            View statistics
          </Link>
        }
      />

      {/* Friends content streams in */}
      <ErrorBoundary fallback={FriendsErrorFallback}>
        <Suspense fallback={<FriendsSkeleton />}>
          <FriendsContent initialTab={initialTab} />
        </Suspense>
      </ErrorBoundary>
    </PageContainer>
  );
}
