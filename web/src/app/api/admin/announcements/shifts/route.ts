import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { findShiftsForAnnouncementPicker } from "@/lib/announcement-targeting";

/**
 * GET /api/admin/announcements/shifts
 *
 * Lists shifts for the announcement form's shift picker. With `ids=`,
 * hydrates exactly those shifts (used to render selected-shift badges from
 * query-string prefill). Otherwise lists upcoming shifts at an optional
 * location for the next `days` days (default 60, max 180).
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const url = new URL(request.url);
  const idsParam = url.searchParams.get("ids");
  const ids = idsParam
    ? idsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;
  const daysAhead = parseInt(url.searchParams.get("days") ?? "60", 10) || 60;

  const shifts = await findShiftsForAnnouncementPicker({
    ids,
    location: url.searchParams.get("location"),
    daysAhead,
  });

  return NextResponse.json({ shifts });
}
