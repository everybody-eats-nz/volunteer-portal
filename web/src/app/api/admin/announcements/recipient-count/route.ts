import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { countAnnouncementRecipients } from "@/lib/announcement-targeting";

/**
 * POST /api/admin/announcements/recipient-count
 *
 * Returns how many volunteers would receive an announcement with the given
 * targeting filters. Powers the live counter on the admin form.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const {
    targetLocations = [],
    targetGrades = [],
    targetLabelIds = [],
    targetUserIds = [],
    targetShiftIds = [],
  } = body;

  const count = await countAnnouncementRecipients({
    targetLocations: Array.isArray(targetLocations) ? targetLocations : [],
    targetGrades: Array.isArray(targetGrades) ? targetGrades : [],
    targetLabelIds: Array.isArray(targetLabelIds) ? targetLabelIds : [],
    targetUserIds: Array.isArray(targetUserIds) ? targetUserIds : [],
    targetShiftIds: Array.isArray(targetShiftIds) ? targetShiftIds : [],
  });

  return NextResponse.json({ count });
}
