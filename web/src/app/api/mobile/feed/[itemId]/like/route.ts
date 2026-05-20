import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";
import { resolveFeedItemOwner } from "@/lib/feed/feed-item-owner";
import { notifyFeedItemLiked } from "@/lib/notifications";

/**
 * POST /api/mobile/feed/[itemId]/like
 *
 * Toggles a like on a feed item for the authenticated user.
 * Returns { liked: boolean, likeCount: number }.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = auth;
  const { itemId } = await params;

  if (!itemId || itemId.length > 200) {
    return NextResponse.json({ error: "Invalid item ID" }, { status: 400 });
  }

  // Check if already liked
  const existing = await prisma.feedLike.findUnique({
    where: { userId_feedItemId: { userId, feedItemId: itemId } },
  });

  if (existing) {
    // Unlike
    await prisma.feedLike.delete({
      where: { userId_feedItemId: { userId, feedItemId: itemId } },
    });
  } else {
    // Like
    await prisma.feedLike.create({
      data: { userId, feedItemId: itemId },
    });
  }

  const likeCount = await prisma.feedLike.count({
    where: { feedItemId: itemId },
  });

  const liked = !existing;

  // Fire-and-forget notification on transition to liked. Don't notify self.
  if (liked) {
    notifyFeedOwnerOfLike(itemId, userId).catch((err) =>
      console.error("Error notifying feed item owner of like:", err)
    );
  }

  return NextResponse.json({ liked, likeCount });
}

async function notifyFeedOwnerOfLike(feedItemId: string, actorUserId: string) {
  const owner = await resolveFeedItemOwner(feedItemId);
  if (!owner || owner.ownerId === actorUserId) return;

  const actor = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { firstName: true, name: true },
  });
  const actorName =
    actor?.firstName?.trim() ||
    actor?.name?.trim() ||
    "A volunteer";

  await notifyFeedItemLiked({
    recipientUserId: owner.ownerId,
    feedItemId,
    itemLabel: owner.itemLabel,
    actorName,
  });
}
