import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { deleteFile, extractFilePathFromUrl, STORAGE_BUCKET } from "@/lib/storage";
import { parseAnnouncementCategory } from "@/lib/announcement-categories";

/**
 * PATCH /api/admin/announcements/[id]
 *
 * Re-categorises an announcement. Category is the only editable field: the
 * message has already gone out, but its category decides who keeps seeing it
 * once volunteers can opt out (and existing rows were backfilled to URGENT).
 *
 * Body: { category }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const announcement = await prisma.announcement.findUnique({
    where: { id },
    select: { targetShiftIds: true },
  });
  if (!announcement) {
    return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
  }

  const parsed = parseAnnouncementCategory(
    body.category,
    announcement.targetShiftIds
  );
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const updated = await prisma.announcement.update({
    where: { id },
    data: { category: parsed.category },
    select: { id: true, category: true },
  });

  return NextResponse.json({ announcement: updated });
}

/**
 * DELETE /api/admin/announcements/[id]
 *
 * Deletes an announcement and its associated image (if any).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;

  const announcement = await prisma.announcement.findUnique({
    where: { id },
    select: { id: true, imageUrl: true },
  });

  if (!announcement) {
    return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
  }

  // Delete the image from Supabase if one exists
  if (announcement.imageUrl) {
    const filePath = extractFilePathFromUrl(announcement.imageUrl);
    if (filePath) {
      await deleteFile(filePath, STORAGE_BUCKET).catch((err) => {
        console.warn("Could not delete announcement image:", err);
      });
    }
  }

  await prisma.announcement.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
