import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  countAnnouncementRecipients,
  parseTargetingFromRequest,
} from "@/lib/announcement-targeting";
import { isAnnouncementCategory } from "@/lib/announcement-categories";

/**
 * POST /api/admin/announcements/recipient-count
 *
 * Returns how many volunteers would receive an announcement with the given
 * targeting filters and `category`, and how many more matched but opted out
 * of that category. Powers the live counter on the admin form. Without a
 * category (none picked yet) nobody counts as opted out.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { count, optedOut } = await countAnnouncementRecipients(
    parseTargetingFromRequest(body),
    isAnnouncementCategory(body.category) ? body.category : null
  );
  return NextResponse.json({ count, optedOut });
}
