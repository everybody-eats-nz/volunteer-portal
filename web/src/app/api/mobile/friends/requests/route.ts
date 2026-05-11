import { NextResponse } from "next/server";
import { requireMobileUser } from "@/lib/mobile-auth";
import { sendFriendRequestFromUserToUser } from "@/lib/friend-request-service";

/**
 * POST /api/mobile/friends/requests
 *
 * Sends a friend request from the authenticated mobile user to the user
 * identified by `toUserId` in the request body. Used by the mobile
 * suggested-friends list.
 */
export async function POST(request: Request) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const toUserId =
    body && typeof body === "object" && "toUserId" in body
      ? (body as { toUserId: unknown }).toUserId
      : undefined;

  if (typeof toUserId !== "string" || toUserId.length === 0) {
    return NextResponse.json(
      { error: "toUserId is required" },
      { status: 400 }
    );
  }

  const result = await sendFriendRequestFromUserToUser(auth.userId, toUserId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, requestId: result.requestId });
}
