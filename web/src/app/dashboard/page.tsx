import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageContainer } from "@/components/page-container";
import { ContentGrid } from "@/components/dashboard-animated";
import { DashboardAchievementsServer } from "@/components/dashboard-achievements-server";
import { DashboardStats } from "@/components/dashboard-stats";
import { DashboardNextShift } from "@/components/dashboard-next-shift";
import { DashboardRecentActivity } from "@/components/dashboard-recent-activity";
import { DashboardStatsSkeleton } from "@/components/dashboard-stats-skeleton";
import { DashboardContentSkeleton } from "@/components/dashboard-content-skeleton";
import { DashboardImpactStats } from "@/components/dashboard-impact-stats";

import { ProfileCompletionBannerServer } from "@/components/profile-completion-banner-server";
import { DashboardSurveyBannerServer } from "@/components/dashboard-survey-banner-server";
import { DashboardSuggestedFriends } from "@/components/dashboard-suggested-friends";
import { AchievementTracker } from "@/components/achievement-tracker";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
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

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const userName = session?.user?.name;
  const firstName = userName?.split(" ")[0];

  if (!userId) {
    redirect("/login?callbackUrl=/dashboard");
  }

  const hour = new Date().toLocaleString("en-NZ", { timeZone: "Pacific/Auckland", hour: "numeric", hour12: false });
  const greeting = parseInt(hour, 10) < 12 ? "Mōrena" : "Kia ora";

  return (
    <PageContainer testid="dashboard-page">
      {/* Branded greeting header — page-local, matches the shifts flow's
          eyebrow + Fraunces display treatment (new.everybodyeats.nz). */}
      <header className="pb-2">
        <p className="eyebrow mb-4 flex items-center gap-3 text-forest-500/80 dark:text-cream-50/60">
          <span className="inline-block h-px w-8 bg-forest-500/50 dark:bg-cream-50/40" />
          Your volunteer dashboard
        </p>
        <h1
          className="display flex flex-wrap items-baseline gap-x-3 text-4xl leading-[1.0] tracking-tight text-forest-700 sm:text-5xl lg:text-6xl dark:text-cream-50"
          data-testid="dashboard-welcome-heading"
        >
          <span>
            {greeting}
            {firstName ? (
              <>
                , <em>{firstName}</em>
              </>
            ) : null}
          </span>
          <Sparkle className="h-6 w-6 shrink-0 self-center text-sun-300 sm:h-7 sm:w-7" />
        </h1>
        <p
          className="mt-4 max-w-xl text-lg leading-relaxed text-forest-700/75 dark:text-cream-50/75"
          data-testid="dashboard-page-description"
        >
          Here&apos;s what&apos;s happening with your volunteer journey
        </p>
      </header>

      {/* Profile completion banner - streams in from server */}
      <Suspense fallback={null}>
        <ProfileCompletionBannerServer />
      </Suspense>

      {/* Survey banner - fetched server-side, streams in */}
      <Suspense fallback={null}>
        <DashboardSurveyBannerServer />
      </Suspense>

      {/* Stats Overview - streams in when ready */}
      <Suspense fallback={<DashboardStatsSkeleton />}>
        <DashboardStats userId={userId} />
      </Suspense>

      <ContentGrid>
        {/* Next Shift - streams in when ready */}
        <Suspense fallback={<DashboardContentSkeleton />}>
          <DashboardNextShift userId={userId} />
        </Suspense>

        {/* Suggested Friends - only renders if there are suggestions */}
        <Suspense fallback={null}>
          <DashboardSuggestedFriends />
        </Suspense>

        {/* Achievements - fetched server-side, streams in when ready */}
        <Suspense fallback={<DashboardContentSkeleton />}>
          <DashboardAchievementsServer />
        </Suspense>

        {/* Recent Activity - streams in when ready */}
        <Suspense fallback={<DashboardContentSkeleton />}>
          <DashboardRecentActivity userId={userId} />
        </Suspense>

        {/* Impact & Community Stats - streams in when ready */}
        <Suspense fallback={<DashboardContentSkeleton />}>
          <DashboardImpactStats userId={userId} />
        </Suspense>
      </ContentGrid>

      {/* Achievement Tracker - client component for celebration dialog */}
      <AchievementTracker />
    </PageContainer>
  );
}
