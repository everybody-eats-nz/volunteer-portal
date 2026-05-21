import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";
import { filterContent } from "@/lib/content-filter";
import { resolveFeedItemOwner } from "@/lib/feed/feed-item-owner";
import {
  notifyFeedItemCommented,
  notifyFeedItemCommentReply,
} from "@/lib/notifications";

/**
 * GET /api/mobile/feed/[itemId]/comments
 *
 * Returns all comments for a feed item, oldest first.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { itemId } = await params;

  if (!itemId || itemId.length > 200) {
    return NextResponse.json({ error: "Invalid item ID" }, { status: 400 });
  }

  // Get users that this person has blocked (hide their comments)
  const blocks = await prisma.userBlock.findMany({
    where: { blockerId: auth.userId },
    select: { blockedId: true },
  });
  const blockedIds = blocks.map((b) => b.blockedId);

  const comments = await prisma.feedComment.findMany({
    where: {
      feedItemId: itemId,
      ...(blockedIds.length > 0 ? { userId: { notIn: blockedIds } } : {}),
    },
    include: {
      user: {
        select: { id: true, name: true, firstName: true, profilePhotoUrl: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const result = comments.map((c) => ({
    id: c.id,
    userId: c.userId,
    userName: c.user.firstName ?? c.user.name ?? "Volunteer",
    profilePhotoUrl: c.user.profilePhotoUrl ?? undefined,
    text: c.text,
    timestamp: c.createdAt.toISOString(),
  }));

  return NextResponse.json({ comments: result });
}

/**
 * POST /api/mobile/feed/[itemId]/comments
 *
 * Adds a comment to a feed item. Body: { text: string }
 * Returns the created comment.
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

  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";

  if (!text || text.length === 0) {
    return NextResponse.json({ error: "Comment text is required" }, { status: 400 });
  }
  if (text.length > 1000) {
    return NextResponse.json({ error: "Comment too long (max 1000 characters)" }, { status: 400 });
  }

  const filterError = filterContent(text);
  if (filterError) {
    return NextResponse.json({ error: filterError }, { status: 422 });
  }

  const [comment, user] = await Promise.all([
    prisma.feedComment.create({
      data: { userId, feedItemId: itemId, text },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, firstName: true, profilePhotoUrl: true },
    }),
  ]);

  const actorName = user?.firstName ?? user?.name ?? "Volunteer";

  // Fire-and-forget: notify the owner + fan out to other thread participants.
  notifyCommentRecipients(itemId, userId, actorName, comment.text).catch(
    (err) => console.error("Error notifying feed comment recipients:", err)
  );

  return NextResponse.json({
    comment: {
      id: comment.id,
      userId: comment.userId,
      userName: actorName,
      profilePhotoUrl: user?.profilePhotoUrl ?? undefined,
      text: comment.text,
      timestamp: comment.createdAt.toISOString(),
    },
  });
}

async function notifyCommentRecipients(
  feedItemId: string,
  actorUserId: string,
  actorName: string,
  commentText: string
) {
  const owner = await resolveFeedItemOwner(feedItemId);

  // 1. Owner notification (skip if owner is the actor or item has no owner)
  if (owner && owner.ownerId !== actorUserId) {
    await notifyFeedItemCommented({
      recipientUserId: owner.ownerId,
      feedItemId,
      itemLabel: owner.itemLabel,
      actorName,
      commentText,
    });
  }

  // 2. Thread-participant fan-out: everyone else who has commented on this
  // item, minus the actor and (if known) the owner who already got #1.
  const participants = await prisma.feedComment.findMany({
    where: { feedItemId },
    select: { userId: true },
    distinct: ["userId"],
  });

  const excluded = new Set<string>([actorUserId]);
  if (owner) excluded.add(owner.ownerId);

  const recipientUserIds = participants
    .map((p) => p.userId)
    .filter((id) => !excluded.has(id));

  if (recipientUserIds.length > 0) {
    await notifyFeedItemCommentReply({
      recipientUserIds,
      feedItemId,
      actorName,
      commentText,
    });
  }
}
