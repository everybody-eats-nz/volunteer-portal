import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getYearInReviewSettings } from "@/lib/year-in-review-settings";
import { hasYearInReview } from "@/lib/year-in-review.server";

/**
 * Points volunteers at their Year in mahi video once an admin has switched it
 * on, for anyone (admin or volunteer) with a completed shift that year.
 */
export async function DashboardYearInReviewBanner() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return null;

  const settings = await getYearInReviewSettings();
  if (!settings.enabled || !(await hasYearInReview(userId, settings.year))) {
    return null;
  }

  return (
    <Link
      href="/year-in-review"
      data-testid="dashboard-year-in-review-banner"
      className="group relative mb-4 flex items-center justify-between gap-6 overflow-hidden rounded-2xl bg-forest-700 px-6 py-5 text-cream-50 transition-colors hover:bg-forest-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 sm:px-8 sm:py-6"
    >
      <div className="min-w-0">
        <p className="display text-2xl leading-tight text-sun-300 sm:text-3xl">
          Your {settings.year} in mahi is ready
        </p>
        <p className="mt-1 text-sm text-cream-50/80 sm:text-base">
          Watch your year at Everybody Eats, then share it.
        </p>
      </div>
      <ArrowRight
        aria-hidden
        className="size-6 shrink-0 text-sun-300 transition-transform group-hover:translate-x-1"
      />
    </Link>
  );
}
