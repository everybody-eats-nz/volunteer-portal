import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMobileUser } from "@/lib/mobile-auth";
import { friendRequestLimiter } from "@/lib/rate-limit";
import {
  FRIEND_REQUEST_MESSAGE_MAX_LENGTH,
  sendFriendRequestFromUserToEmail,
  sendFriendRequestFromUserToUser,
} from "@/lib/friend-request-service";

/** From the suggested-friends list. */
const byUserIdSchema = z.object({
  toUserId: z.string({ error: "toUserId is required" }).min(1, "toUserId is required"),
});

/** Typed in by the volunteer, for someone who isn't suggested. */
const byEmailSchema = z.object({
  email: z
    .string({ error: "Enter a valid email address" })
    .trim()
    .email("Enter a valid email address"),
  message: z
    .string()
    .trim()
    .max(
      FRIEND_REQUEST_MESSAGE_MAX_LENGTH,
      `Keep your message under ${FRIEND_REQUEST_MESSAGE_MAX_LENGTH} characters`
    )
    .optional(),
});

/**
 * POST /api/mobile/friends/requests
 *
 * Sends a friend request from the authenticated mobile user, either to the
 * user identified by `toUserId` (the suggested-friends list) or to whoever
 * signed up with `email` (Add a friend), with an optional `message`.
 *
 * Email requests share the web's friend-request rate limit: a typed email
 * reveals whether that address has an account (and, if so, their request
 * setting and whether you are already connected), so it must not be cheap to
 * try many. Tapping Add on a suggestion reveals nothing and isn't limited.
 * The limiter is in memory, so the budget is per server instance, the same
 * as on the web route.
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

  const isEmailRequest =
    !!body && typeof body === "object" && "email" in body;

  let result;
  if (!isEmailRequest) {
    const parsed = byUserIdSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }
    result = await sendFriendRequestFromUserToUser(
      auth.userId,
      parsed.data.toUserId
    );
  } else {
    const parsed = byEmailSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const limit = friendRequestLimiter(`user:${auth.userId}`);
    if (!limit.success) {
      return NextResponse.json(
        {
          error:
            "You've sent a lot of requests in a short time. Try again in a few minutes.",
          retryAfter: Math.ceil((limit.resetTime - Date.now()) / 1000),
        },
        { status: 429 }
      );
    }
    result = await sendFriendRequestFromUserToEmail(
      auth.userId,
      parsed.data.email,
      { message: parsed.data.message }
    );
  }

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, requestId: result.requestId });
}
