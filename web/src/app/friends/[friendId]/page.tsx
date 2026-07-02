import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth-options";
import { MotionPageContainer } from "@/components/motion-page-container";
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

/** Loading skeleton mirroring the redesigned layout: dark profile panel,
    stat band, two panels, upcoming shifts. */
function FriendProfileSkeleton() {
  return (
    <div className="animate-pulse space-y-8" aria-hidden>
      {/* Profile header panel */}
      <div className="rounded-[2rem] bg-forest-700/90 p-6 sm:p-10">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <div className="h-24 w-24 rounded-full bg-cream-50/10 sm:h-28 sm:w-28" />
          <div className="flex-1 space-y-3">
            <div className="h-3 w-40 rounded-full bg-cream-50/10" />
            <div className="h-10 w-56 rounded-full bg-cream-50/10" />
            <div className="h-4 w-36 rounded-full bg-cream-50/10" />
          </div>
        </div>
      </div>

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
        {[1, 2].map((i) => (
          <div
            key={i}
            className="rounded-[2rem] border border-forest-500/10 bg-card p-6 sm:p-8 dark:border-cream-50/10"
          >
            <div className="h-3 w-36 rounded-full bg-forest-500/10 dark:bg-cream-50/10" />
            <div className="mt-3 h-8 w-48 rounded-full bg-forest-500/10 dark:bg-cream-50/10" />
            <div className="mt-6 space-y-3">
              {[1, 2, 3].map((j) => (
                <div
                  key={j}
                  className="h-16 rounded-2xl bg-forest-500/5 ring-1 ring-forest-500/10 dark:bg-cream-50/5 dark:ring-cream-50/10"
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Upcoming shifts panel */}
      <div className="rounded-[2rem] border border-forest-500/10 bg-card p-6 sm:p-8 dark:border-cream-50/10">
        <div className="h-3 w-44 rounded-full bg-forest-500/10 dark:bg-cream-50/10" />
        <div className="mt-3 h-8 w-64 rounded-full bg-forest-500/10 dark:bg-cream-50/10" />
        <div className="mt-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 rounded-2xl bg-forest-500/5 ring-1 ring-forest-500/10 dark:bg-cream-50/5 dark:ring-cream-50/10"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

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
        <div>
          <Link
            href="/friends"
            className="inline-flex items-center gap-2 rounded-full border border-forest-500/20 px-4 py-2 text-xs font-medium text-forest-700/80 transition-all duration-200 hover:border-forest-500/50 hover:text-forest-700 dark:border-cream-50/20 dark:text-cream-50/75 dark:hover:border-cream-50/50 dark:hover:text-cream-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">Back to Friends</span>
            <span className="sm:hidden">Back</span>
          </Link>
        </div>

        {/* Friend profile content streams in */}
        <Suspense fallback={<FriendProfileSkeleton />}>
          <FriendProfileContent friendId={friendId} />
        </Suspense>
      </div>
    </MotionPageContainer>
  );
}
