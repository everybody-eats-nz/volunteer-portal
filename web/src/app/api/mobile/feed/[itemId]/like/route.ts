import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";

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

  return NextResponse.json({ liked: !existing, likeCount });
}
