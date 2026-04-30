import { NextResponse } from "next/server";
import { requireMobileUser } from "@/lib/mobile-auth";
import {
  getOrCreateThreadForVolunteer,
  sendMessage,
  MessagingError,
} from "@/lib/services/messaging";

export async function POST(request: Request) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: string;
  try {
    const json = (await request.json()) as { body?: unknown };
    if (typeof json.body !== "string") {
      return NextResponse.json({ error: "body is required" }, { status: 400 });
    }
    body = json.body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    // Auto-create thread on first send.
    const thread = await getOrCreateThreadForVolunteer(auth.userId);
    const message = await sendMessage({
      threadId: thread.id,
      senderId: auth.userId,
      senderRole: "VOLUNTEER",
      body,
    });
    return NextResponse.json({ message });
  } catch (err) {
    if (err instanceof MessagingError) {
      const code =
        err.code === "NOT_FOUND" ? 404 : err.code === "FORBIDDEN" ? 403 : 400;
      return NextResponse.json({ error: err.message }, { status: code });
    }
    console.error("[mobile messages send]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
