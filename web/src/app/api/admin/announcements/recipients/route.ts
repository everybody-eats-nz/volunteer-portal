import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  findAnnouncementRecipients,
  parseTargetingFromRequest,
} from "@/lib/announcement-targeting";

/** Cap the preview list so a broad audience doesn't ship thousands of rows. */
const MAX_PREVIEW_RECIPIENTS = 300;

/**
 * POST /api/admin/announcements/recipients
 *
 * Returns the volunteers matched by the given targeting filters — the same
 * matching logic the send path uses. Powers the "see exactly who" list under
 * the recipient count in the composer. The list is alphabetised and capped
 * at MAX_PREVIEW_RECIPIENTS; `total` always reflects the full audience.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const recipients = await findAnnouncementRecipients(
    parseTargetingFromRequest(body)
  );

  // One display name, resolved server-side and used for both the sort and the
  // rendered label. Deriving them separately lets the two fall out of step —
  // a volunteer whose `name` and `firstName` disagree then sorts under one
  // and renders as the other, and the list reads as unsorted.
  const rows = recipients.map((r) => ({
    id: r.id,
    displayName: r.name ?? r.firstName ?? r.email,
    email: r.email,
  }));
  rows.sort((a, b) =>
    a.displayName.localeCompare(b.displayName, "en", { sensitivity: "base" })
  );

  return NextResponse.json({
    total: rows.length,
    recipients: rows.slice(0, MAX_PREVIEW_RECIPIENTS),
  });
}
