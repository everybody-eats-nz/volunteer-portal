import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageContainer } from "@/components/page-container";
import { MyShiftsContent } from "./my-shifts-content";
import { MyShiftsContentSkeleton } from "./my-shifts-skeleton";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Shifts",
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

export default async function MyShiftsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/login?callbackUrl=/shifts/mine");
  }

  const params = await searchParams;
  const monthParam = params.month as string | undefined;

  return (
    <PageContainer testid="my-shifts-page">
      {/* Branded header — eyebrow + Fraunces display treatment, matching the
          dashboard, shifts and profile pages (new.everybodyeats.nz). */}
      <header className="pb-4">
        <p className="eyebrow mb-4 flex items-center gap-3 text-forest-500/80 dark:text-cream-50/60">
          <span className="inline-block h-px w-8 bg-forest-500/50 dark:bg-cream-50/40" />
          Kia ora · Your mahi diary
        </p>
        <h1 className="display flex flex-wrap items-baseline gap-x-3 text-4xl leading-[1.0] tracking-tight text-forest-700 sm:text-5xl lg:text-6xl dark:text-cream-50">
          <span>
            My <em>Shifts</em>
          </span>
          <Sparkle className="h-6 w-6 shrink-0 self-center text-sun-300 sm:h-7 sm:w-7" />
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-forest-700/75 dark:text-cream-50/75">
          Your volunteer schedule and shift history.
        </p>
      </header>

      <Suspense fallback={<MyShiftsContentSkeleton />}>
        <MyShiftsContent userId={userId} monthParam={monthParam} />
      </Suspense>
    </PageContainer>
  );
}
