import { Suspense } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { getMobileUserFromHeaders } from "@/lib/mobile-auth";
import {
  canViewYearInReview,
  getYearInReviewSettings,
} from "@/lib/year-in-review-settings";
import { getVolunteerYearInReview } from "@/lib/year-in-review.server";
import { YearInReviewPlayerFrame } from "@/components/year-in-review/year-in-review-player-frame";

export const metadata: Metadata = {
  title: "Your year in mahi",
  robots: { index: false, follow: false },
};

/**
 * The Year in mahi player for the mobile app, which opens this page in a
 * WebView with the volunteer's bearer token as an Authorization header. No
 * site header or footer (see isEmbedPath); the app draws its own, and its
 * own Save or share button (it fetches the server-rendered MP4 natively).
 */
export default function YearInReviewEmbedPage() {
  return (
    <div className="min-h-dvh bg-forest-700 px-4 py-4 text-cream-50">
      <Suspense fallback={<Message>Loading your year…</Message>}>
        <EmbedContent />
      </Suspense>
    </div>
  );
}

async function EmbedContent() {
  const user = await getMobileUserFromHeaders(await headers());
  if (!user) {
    return <Message>Sign in again to see your year in mahi.</Message>;
  }

  const settings = await getYearInReviewSettings();
  if (!canViewYearInReview(settings, user)) {
    return <Message>Your year in mahi isn&apos;t out yet.</Message>;
  }

  const data = await getVolunteerYearInReview(user.id, settings.year);
  if (!data) {
    return (
      <Message>
        No shifts in {settings.year} yet. Once you&apos;ve done one, your year
        in mahi will show up here.
      </Message>
    );
  }

  return (
    <YearInReviewPlayerFrame
      data={data}
      // Fills the WebView, which the app sizes to leave room for its button.
      className="mx-auto max-w-[min(100%,calc((100dvh-3rem)*9/16))] rounded-3xl ring-1 ring-cream-50/15"
    />
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <p
      data-testid="year-in-review-embed-message"
      className="mx-auto max-w-sm pt-24 text-center text-lg text-cream-50/85"
    >
      {children}
    </p>
  );
}
