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

export const metadata: Metadata = {
  title: "Friends",
  robots: {
    index: false,
    follow: false,
  },
};

/** Four-point sparkle — the marketing site's signature accent mark. */
function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 0c.6 6.5 5.5 11.4 12 12-6.5.6-11.4 5.5-12 12-.6-6.5-5.5-11.4-12-12C6.5 11.4 11.4 6.5 12 0z" />
    </svg>
  );
}

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
    <PageContainer testid="friends-page">
      {/* Branded header — eyebrow + Fraunces display treatment, matching the
          dashboard, shifts and profile pages (new.everybodyeats.nz). */}
      <div className="flex flex-col gap-6 pb-8 lg:flex-row lg:items-end lg:justify-between">
        <header>
          <p className="eyebrow mb-4 flex items-center gap-3 text-forest-500/80 dark:text-cream-50/60">
            <span className="inline-block h-px w-8 bg-forest-500/50 dark:bg-cream-50/40" />
            Kia ora · Your volunteer whānau
          </p>
          <h1 className="display flex flex-wrap items-baseline gap-x-3 text-4xl leading-[1.0] tracking-tight text-forest-700 sm:text-5xl lg:text-6xl dark:text-cream-50">
            <span>
              My <em>Friends</em>
            </span>
            <Sparkle className="h-6 w-6 shrink-0 self-center text-sun-300 sm:h-7 sm:w-7" />
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-forest-700/75 dark:text-cream-50/75">
            Volunteering is better together — keep up with the people you meet
            on the mahi.
          </p>
        </header>
        <Link
          href="/friends/stats"
          className={`${pillGhost} w-fit shrink-0`}
          data-testid="view-statistics-link"
        >
          <BarChart3 className="h-4 w-4" aria-hidden />
          View Statistics
        </Link>
      </div>

      {/* Friends content streams in */}
      <ErrorBoundary fallback={FriendsErrorFallback}>
        <Suspense fallback={<FriendsSkeleton />}>
          <FriendsContent initialTab={initialTab} />
        </Suspense>
      </ErrorBoundary>
    </PageContainer>
  );
}
