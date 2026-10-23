import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  canManageYearInReview,
  selectableYears,
} from "@/lib/year-in-review-settings";
import { getVolunteerYearInReview } from "@/lib/year-in-review.server";

/**
 * GET /api/admin/year-in-review/[userId]?year=2026
 *
 * The video props for anyone (admin or volunteer), so an admin can watch and
 * download a person's video. `data` is null when they have no completed
 * shifts that year.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canManageYearInReview(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { userId } = await params;
  const year = Number(new URL(request.url).searchParams.get("year"));
  if (!selectableYears().includes(year)) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }

  const data = await getVolunteerYearInReview(userId, year);
  return NextResponse.json({ data });
}
