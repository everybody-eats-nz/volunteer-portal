import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";

/**
 * POST /api/mobile/friends/requests/[requestId]/decline
 *
 * Mobile equivalent of /api/friends/requests/[requestId]/decline. Marks the
 * pending FriendRequest as DECLINED after verifying it was addressed to the
 * caller.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = auth;
  const { requestId } = await params;

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!me) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const friendRequest = await prisma.friendRequest.findUnique({
    where: { id: requestId },
    select: { id: true, toEmail: true, status: true },
  });

  if (!friendRequest) {
    return NextResponse.json(
      { error: "Friend request not found" },
      { status: 404 }
    );
  }

  if (friendRequest.toEmail !== me.email) {
    return NextResponse.json(
      { error: "Unauthorized to decline this request" },
      { status: 403 }
    );
  }

  if (friendRequest.status !== "PENDING") {
    return NextResponse.json(
      { error: "Friend request is no longer pending" },
      { status: 400 }
    );
  }

  await prisma.friendRequest.update({
    where: { id: requestId },
    data: { status: "DECLINED" },
  });

  return NextResponse.json({ ok: true, status: "NONE" });
}
