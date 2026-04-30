import { NextResponse } from "next/server";
import { requireMobileUser } from "@/lib/mobile-auth";
import { countUnreadForVolunteer } from "@/lib/services/messaging";

/**
 * GET /api/mobile/messages/unread-count
 *
 * Lightweight endpoint for the mobile tab badge. Returns the count of
 * admin-sent messages in the user's thread that arrived after their
 * last-read marker.
 */
export async function GET(request: Request) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const count = await countUnreadForVolunteer(auth.userId);
  return NextResponse.json({ count });
}
