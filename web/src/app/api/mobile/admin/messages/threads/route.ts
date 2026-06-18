import { NextResponse } from "next/server";
import { requireMobileAdmin } from "@/lib/mobile-auth";
import {
  getOrCreateThreadForVolunteer,
  listThreadsForAdmin,
  MessagingError,
} from "@/lib/services/messaging";

/**
 * GET /api/mobile/admin/messages/threads
 *
 * JWT-authed mirror of the web admin threads list. Powers the mobile admin
 * inbox. Shares the same query params (status, unread, q, location, cursor,
 * limit) and the same service layer as the web route.
 */
export async function GET(req: Request) {
  const auth = await requireMobileAdmin(req);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = (url.searchParams.get("status") ?? "OPEN").toUpperCase();
  const unreadOnly = url.searchParams.get("unread") === "true";
  const search = url.searchParams.get("q") ?? undefined;
  const location = url.searchParams.get("location") ?? undefined;
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? 30);

  if (status !== "OPEN" && status !== "RESOLVED" && status !== "ALL") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    const threads = await listThreadsForAdmin({
      status: status as "OPEN" | "RESOLVED" | "ALL",
      unreadOnly,
      search,
      location,
      cursor,
      limit,
    });
    return NextResponse.json({ threads });
  } catch (err) {
    console.error("[mobile/admin/messages/threads GET]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * POST /api/mobile/admin/messages/threads
 *
 * Get-or-create a thread for a volunteer so an admin can start a conversation
 * from the volunteer's profile. Body: { volunteerId }.
 */
export async function POST(req: Request) {
  const auth = await requireMobileAdmin(req);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let volunteerId: string;
  try {
    const body = (await req.json()) as { volunteerId?: unknown };
    if (typeof body.volunteerId !== "string" || !body.volunteerId) {
      return NextResponse.json(
        { error: "volunteerId is required" },
        { status: 400 }
      );
    }
    volunteerId = body.volunteerId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const thread = await getOrCreateThreadForVolunteer(volunteerId);
    return NextResponse.json({ thread });
  } catch (err) {
    if (err instanceof MessagingError) {
      const code = err.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: err.message }, { status: code });
    }
    console.error("[mobile/admin/messages/threads POST]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
