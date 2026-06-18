import { NextResponse } from "next/server";
import { requireMobileAdmin } from "@/lib/mobile-auth";
import { setThreadStatus } from "@/lib/services/messaging";

/**
 * POST /api/mobile/admin/messages/threads/[id]/resolve
 * Toggles a thread between OPEN and RESOLVED. Body: { status? } defaults to
 * RESOLVED.
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

  let status: "OPEN" | "RESOLVED" = "RESOLVED";
  try {
    const json = (await req.json().catch(() => ({}))) as { status?: unknown };
    if (json.status === "OPEN" || json.status === "RESOLVED") {
      status = json.status;
    }
  } catch {
    // Default to RESOLVED if no body
  }

  await setThreadStatus(id, status);
  return NextResponse.json({ ok: true, status });
}
