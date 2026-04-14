import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";

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

  const comments = await prisma.feedComment.findMany({
    where: { feedItemId: itemId },
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

  const [comment, user] = await Promise.all([
    prisma.feedComment.create({
      data: { userId, feedItemId: itemId, text },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, firstName: true, profilePhotoUrl: true },
    }),
  ]);

  return NextResponse.json({
    comment: {
      id: comment.id,
      userId: comment.userId,
      userName: user?.firstName ?? user?.name ?? "Volunteer",
      profilePhotoUrl: user?.profilePhotoUrl ?? undefined,
      text: comment.text,
      timestamp: comment.createdAt.toISOString(),
    },
  });
}
