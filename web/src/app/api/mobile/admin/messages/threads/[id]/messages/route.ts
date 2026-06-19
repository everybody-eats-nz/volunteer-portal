import { NextResponse } from "next/server";
import { requireMobileAdmin } from "@/lib/mobile-auth";
import { sendMessage, MessagingError } from "@/lib/services/messaging";

/**
 * POST /api/mobile/admin/messages/threads/[id]/messages
 *
 * Admin replies to a volunteer from mobile. The message is stamped with the
 * admin's user id and ADMIN role; the service fans out the volunteer
 * notification + push automatically.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMobileAdmin(req);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: threadId } = await params;
  let body: string;
  try {
    const json = (await req.json()) as { body?: unknown };
    if (typeof json.body !== "string") {
      return NextResponse.json({ error: "body is required" }, { status: 400 });
    }
    body = json.body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const message = await sendMessage({
      threadId,
      senderId: auth.userId,
      senderRole: "ADMIN",
      body,
    });
    return NextResponse.json({ message });
  } catch (err) {
    if (err instanceof MessagingError) {
      const code =
        err.code === "NOT_FOUND" ? 404 : err.code === "FORBIDDEN" ? 403 : 400;
      return NextResponse.json({ error: err.message }, { status: code });
    }
    console.error("[mobile/admin messages send]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
