import { NextResponse } from "next/server";
import { requireMobileAdmin } from "@/lib/mobile-auth";
import { countUnreadForTeam } from "@/lib/services/messaging";

/**
 * GET /api/mobile/admin/messages/unread-count
 * Open threads awaiting a team reply. Badges the mobile Admin tab.
 */
export async function GET(req: Request) {
  const auth = await requireMobileAdmin(req);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const count = await countUnreadForTeam();
  return NextResponse.json({ count });
}
