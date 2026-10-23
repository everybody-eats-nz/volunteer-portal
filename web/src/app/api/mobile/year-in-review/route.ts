import { NextResponse } from "next/server";
import { requireMobileUser } from "@/lib/mobile-auth";
import {
  canViewYearInReview,
  getYearInReviewSettings,
} from "@/lib/year-in-review-settings";
import { hasYearInReview } from "@/lib/year-in-review.server";

/**
 * GET /api/mobile/year-in-review
 *
 * Whether to show the Year in mahi card on the app's home tab. The video
 * itself is the web page at /embed/year-in-review, which the app opens in a
 * WebView with the same bearer token.
 */
export async function GET(request: Request) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getYearInReviewSettings();
  const available =
    canViewYearInReview(settings, auth.user) &&
    (await hasYearInReview(auth.userId, settings.year));

  return NextResponse.json({ available, year: settings.year });
}
