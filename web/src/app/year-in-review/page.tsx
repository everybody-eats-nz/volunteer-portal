import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";
import { InfoBox } from "@/components/ui/info-box";
import { YearInReviewPageHeader } from "@/components/year-in-review/year-in-review-page-header";
import { YearInReviewPlayerFrame } from "@/components/year-in-review/year-in-review-player-frame";
import { YearInReviewSharePanel } from "@/components/year-in-review/year-in-review-share-panel";
import { YearInReviewSkeleton } from "@/components/year-in-review/year-in-review-skeleton";
import {
  canViewYearInReview,
  getYearInReviewSettings,
} from "@/lib/year-in-review-settings";
import { getVolunteerYearInReview } from "@/lib/year-in-review.server";

export const metadata: Metadata = {
  title: "Your year in mahi",
  robots: { index: false, follow: false },
};

export default async function YearInReviewPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/login?callbackUrl=/year-in-review");
  }

  const settings = await getYearInReviewSettings();
  const role = session.user.role;

  return (
    <PageContainer testid="year-in-review-page">
      <YearInReviewPageHeader year={settings.year} />
      {canViewYearInReview(settings, role) ? (
        <Suspense fallback={<YearInReviewSkeleton />}>
          <YearInReviewContent
            userId={userId}
            year={settings.year}
            adminPreview={!settings.enabled}
          />
        </Suspense>
      ) : (
        <NotYet />
      )}
    </PageContainer>
  );
}

async function YearInReviewContent({
  userId,
  year,
  adminPreview,
}: {
  userId: string;
  year: number;
  adminPreview: boolean;
}) {
  const data = await getVolunteerYearInReview(userId, year);

  if (!data) {
    return (
      <EmptyState
        title={`No shifts in ${year} yet`}
        body="Once you've done a shift, your year in mahi will show up here."
        action={
          <Button asChild size="lg">
            <Link href="/shifts">Find a shift</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {adminPreview && (
        <InfoBox title="Only admins can see this" variant="amber">
          Volunteers will see their video once it&apos;s switched on in{" "}
          <Link href="/admin/year-in-review" className="font-medium underline">
            Year in mahi settings
          </Link>
          .
        </InfoBox>
      )}
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-12">
        <YearInReviewPlayerFrame
          data={data}
          // Short screens shrink it so the controls stay in view.
          className="mx-auto max-w-[min(400px,calc((100dvh-10rem)*9/16))] lg:mx-0"
        />
        <YearInReviewSharePanel year={data.year} />
      </div>
    </div>
  );
}

function NotYet() {
  return (
    <EmptyState
      title="Not quite ready"
      body="Your year in mahi isn't out yet. We'll let you know when it's ready to watch."
      action={
        <Button asChild size="lg" variant="outline">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      }
    />
  );
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action: React.ReactNode;
}) {
  return (
    <section
      data-testid="year-in-review-empty"
      className="rounded-3xl border border-forest-500/15 bg-card-bg px-6 py-12 text-center sm:px-12 dark:border-cream-50/12"
    >
      <h2 className="display text-3xl text-forest-700 dark:text-cream-50">
        {title}
      </h2>
      <p className="mx-auto mt-3 max-w-md text-muted-foreground">{body}</p>
      <div className="mt-6 flex justify-center">{action}</div>
    </section>
  );
}
