import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { deleteFile, extractFilePathFromUrl, STORAGE_BUCKET } from "@/lib/storage";

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
