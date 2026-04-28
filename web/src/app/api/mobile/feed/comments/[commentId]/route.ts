import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";
import { filterContent } from "@/lib/content-filter";

/**
 * PATCH /api/mobile/feed/comments/[commentId]
 *
 * Edits the text of a comment. Only the author may edit their own comment.
 * Body: { text: string }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { commentId } = await params;
  if (!commentId || commentId.length > 200) {
    return NextResponse.json({ error: "Invalid comment ID" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";

  if (!text) {
    return NextResponse.json({ error: "Comment text is required" }, { status: 400 });
  }
  if (text.length > 1000) {
    return NextResponse.json({ error: "Comment too long (max 1000 characters)" }, { status: 400 });
  }

  const filterError = filterContent(text);
  if (filterError) {
    return NextResponse.json({ error: filterError }, { status: 422 });
  }

  const existing = await prisma.feedComment.findUnique({
    where: { id: commentId },
    select: { userId: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }
  if (existing.userId !== auth.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.feedComment.update({
    where: { id: commentId },
    data: { text },
    include: {
      user: {
        select: { id: true, name: true, firstName: true, profilePhotoUrl: true },
      },
    },
  });

  return NextResponse.json({
    comment: {
      id: updated.id,
      userId: updated.userId,
      userName: updated.user.firstName ?? updated.user.name ?? "Volunteer",
      profilePhotoUrl: updated.user.profilePhotoUrl ?? undefined,
      text: updated.text,
      timestamp: updated.createdAt.toISOString(),
    },
  });
}

/**
 * DELETE /api/mobile/feed/comments/[commentId]
 *
 * Deletes a comment. Only the author may delete their own comment.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { commentId } = await params;
  if (!commentId || commentId.length > 200) {
    return NextResponse.json({ error: "Invalid comment ID" }, { status: 400 });
  }

  const existing = await prisma.feedComment.findUnique({
    where: { id: commentId },
    select: { userId: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }
  if (existing.userId !== auth.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.feedComment.delete({ where: { id: commentId } });

  return NextResponse.json({ ok: true });
}
