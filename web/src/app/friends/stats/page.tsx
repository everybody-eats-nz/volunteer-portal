import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth-options";
import { PageContainer } from "@/components/page-container";
import { ArrowLeft } from "lucide-react";
import { FriendsStatsContent } from "./friends-stats-content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Friendship Statistics",
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

/** Loading skeleton mirroring the redesigned layout: stat band, two panels,
    activity panel. */
function FriendsStatsContentSkeleton() {
  return (
    <div className="animate-pulse space-y-8" aria-hidden>
      {/* Stat band */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-forest-500/10 ring-1 ring-forest-500/10 lg:grid-cols-4 dark:bg-cream-50/10 dark:ring-cream-50/10">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-background px-5 py-6 sm:px-8 sm:py-8">
            <div className="h-10 w-16 rounded-full bg-forest-500/10 dark:bg-cream-50/10" />
            <div className="mt-3 h-3 w-24 rounded-full bg-forest-500/10 dark:bg-cream-50/10" />
          </div>
        ))}
      </div>

      {/* Two panels */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[2rem] border border-forest-500/10 bg-card p-6 sm:p-8 dark:border-cream-50/10">
          <div className="h-3 w-40 rounded-full bg-forest-500/10 dark:bg-cream-50/10" />
          <div className="mt-3 h-8 w-56 rounded-full bg-forest-500/10 dark:bg-cream-50/10" />
          <div className="mt-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <div className="h-10 w-10 rounded-full bg-forest-500/10 dark:bg-cream-50/10" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-28 rounded-full bg-forest-500/10 dark:bg-cream-50/10" />
                  <div className="h-3 w-36 rounded-full bg-forest-500/10 dark:bg-cream-50/10" />
                </div>
                <div className="h-5 w-16 rounded-full bg-forest-500/10 dark:bg-cream-50/10" />
              </div>
            ))}
          </div>
        </div>
        <div className="h-96 rounded-[2rem] bg-forest-700/90" />
      </div>

      {/* Upcoming activity panel */}
      <div className="rounded-[2rem] border border-forest-500/10 bg-card p-6 sm:p-8 dark:border-cream-50/10">
        <div className="h-3 w-48 rounded-full bg-forest-500/10 dark:bg-cream-50/10" />
        <div className="mt-3 h-8 w-64 rounded-full bg-forest-500/10 dark:bg-cream-50/10" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 rounded-2xl bg-forest-500/5 ring-1 ring-forest-500/10 dark:bg-cream-50/5 dark:ring-cream-50/10"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function FriendsStatsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/login?callbackUrl=/friends/stats");
  }

  return (
    <PageContainer testid="friends-stats-page">
      {/* Branded header — eyebrow + Fraunces display treatment, matching the
          friends page (new.everybodyeats.nz). */}
      <header className="pb-8">
        <Link
          href="/friends"
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-forest-500/20 px-4 py-2 text-xs font-medium text-forest-700/80 transition-all duration-200 hover:border-forest-500/50 hover:text-forest-700 dark:border-cream-50/20 dark:text-cream-50/75 dark:hover:border-cream-50/50 dark:hover:text-cream-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to Friends
        </Link>
        <p className="eyebrow mb-4 flex items-center gap-3 text-forest-500/80 dark:text-cream-50/60">
          <span className="inline-block h-px w-8 bg-forest-500/50 dark:bg-cream-50/40" />
          Ngā mihi · Your connections
        </p>
        <h1 className="display flex flex-wrap items-baseline gap-x-3 text-4xl leading-[1.0] tracking-tight text-forest-700 sm:text-5xl lg:text-6xl dark:text-cream-50">
          <span>
            Friendship <em>Statistics</em>
          </span>
          <Sparkle className="h-6 w-6 shrink-0 self-center text-sun-300 sm:h-7 sm:w-7" />
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-forest-700/75 dark:text-cream-50/75">
          Your volunteer community connections and friendship insights.
        </p>
      </header>

      {/* Stats content streams in */}
      <Suspense fallback={<FriendsStatsContentSkeleton />}>
        <FriendsStatsContent />
      </Suspense>
    </PageContainer>
  );
}
