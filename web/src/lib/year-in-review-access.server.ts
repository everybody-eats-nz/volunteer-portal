import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getMobileUser } from "@/lib/mobile-auth";
import {
  canViewYearInReview,
  getYearInReviewSettings,
  selectableYears,
} from "@/lib/year-in-review-settings";

/**
 * Who a Year in mahi video request is for. Works for the web (session) and
 * the app (bearer token) alike: everyone gets their own video once it's
 * switched on (admins before then too), and admins can ask for anyone's, for
 * any recent year, with `?userId=` and `?year=`.
 */
export async function resolveVideoRequest(
  request: Request
): Promise<{ userId: string; year: number } | NextResponse> {
  const mobileUser = await getMobileUser(request);
  const session = mobileUser ? null : await getServerSession(authOptions);
  const viewer = mobileUser
    ? { id: mobileUser.id, role: mobileUser.role }
    : session?.user
      ? { id: session.user.id, role: session.user.role }
      : null;
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const isAdmin = viewer.role === "ADMIN";
  const userId = params.get("userId") || viewer.id;
  if (userId !== viewer.id && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = await getYearInReviewSettings();
  const requestedYear = params.get("year");
  if (requestedYear && isAdmin) {
    const year = Number(requestedYear);
    if (!selectableYears().includes(year)) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }
    return { userId, year };
  }
  if (!canViewYearInReview(settings, viewer.role)) {
    return NextResponse.json(
      { error: "Year in mahi isn't available yet" },
      { status: 403 }
    );
  }
  return { userId, year: settings.year };
}

/** Where the finished MP4 is served from, for this person and year. */
export function videoFileUrl(userId: string, year: number, hash: string) {
  const params = new URLSearchParams({
    userId,
    year: String(year),
    v: hash.slice(0, 12),
  });
  return `/api/year-in-review/video/file?${params}`;
}
