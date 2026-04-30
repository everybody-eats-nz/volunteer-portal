import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { sendMessage, MessagingError } from "@/lib/services/messaging";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN" || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
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
      senderId: session.user.id,
      senderRole: "ADMIN",
      body,
    });
    return NextResponse.json({ message });
  } catch (err) {
    if (err instanceof MessagingError) {
      const code = err.code === "NOT_FOUND" ? 404 : err.code === "FORBIDDEN" ? 403 : 400;
      return NextResponse.json({ error: err.message }, { status: code });
    }
    console.error("[admin messages send]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
