import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";

/**
 * DELETE /api/mobile/friends/[id]
 *
 * Removes an accepted friendship between the authenticated user and the target
 * user. Deletes both directions so neither side sees the other as a friend.
 *
 * NOTE: The GET handler that previously lived here returned a rich friend
 * profile. That data is now folded into GET /api/mobile/users/[id] under a
 * `connection` field that the server only populates for accepted friends —
 * letting the unified mobile profile screen render full vs trimmed states
 * from a single fetch.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = auth;
  const { id: friendId } = await params;

  if (!friendId || friendId === userId) {
    return NextResponse.json({ error: "Invalid friend ID" }, { status: 400 });
  }

  const existing = await prisma.friendship.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { userId, friendId },
        { userId: friendId, friendId: userId },
      ],
    },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Friendship not found" },
      { status: 404 }
    );
  }

  await prisma.friendship.deleteMany({
    where: {
      status: "ACCEPTED",
      OR: [
        { userId, friendId },
        { userId: friendId, friendId: userId },
      ],
    },
  });

  return NextResponse.json({ ok: true, removed: true });
}
