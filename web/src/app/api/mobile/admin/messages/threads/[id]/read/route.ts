import { NextResponse } from "next/server";
import { requireMobileAdmin } from "@/lib/mobile-auth";
import { markThreadRead } from "@/lib/services/messaging";

/**
 * POST /api/mobile/admin/messages/threads/[id]/read
 * Marks the thread read for the admin team side.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMobileAdmin(req);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  await markThreadRead(id, "team");
  return NextResponse.json({ ok: true });
}
