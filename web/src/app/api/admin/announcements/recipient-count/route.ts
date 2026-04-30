import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  AnnouncementTargeting,
  countAnnouncementRecipients,
} from "@/lib/announcement-targeting";

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
  const targeting: AnnouncementTargeting = {
    targetLocations: Array.isArray(body.targetLocations)
      ? body.targetLocations
      : [],
    targetGrades: Array.isArray(body.targetGrades) ? body.targetGrades : [],
    targetLabelIds: Array.isArray(body.targetLabelIds)
      ? body.targetLabelIds
      : [],
    targetUserIds: Array.isArray(body.targetUserIds) ? body.targetUserIds : [],
    targetShiftIds: Array.isArray(body.targetShiftIds)
      ? body.targetShiftIds
      : [],
  };

  const count = await countAnnouncementRecipients(targeting);
  return NextResponse.json({ count });
}
