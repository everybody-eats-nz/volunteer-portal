import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { uploadFile, deleteFile, ALLOWED_FILE_TYPES, MAX_FILE_SIZE, PROFILE_PHOTOS_BUCKET } from "@/lib/storage";
import { extractFilePathFromUrl } from "@/lib/storage-utils";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ profilePhotoUrl: null });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { profilePhotoUrl: true },
  });

  return NextResponse.json({
    profilePhotoUrl: user?.profilePhotoUrl ?? null,
  });
}

/**
 * POST /api/profile/photo
 *
 * Upload a profile photo to Supabase Storage and save the URL.
 * Accepts multipart/form-data with a "photo" field.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("photo") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No photo provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Photo exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit.` },
        { status: 400 },
      );
    }

    if (!ALLOWED_FILE_TYPES.IMAGE.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Please use JPEG, PNG, or WebP." },
        { status: 400 },
      );
    }

    // Delete old photo from storage if it's a Supabase URL (not base64)
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { profilePhotoUrl: true },
    });

    if (currentUser?.profilePhotoUrl && !currentUser.profilePhotoUrl.startsWith("data:")) {
      const oldPath = extractFilePathFromUrl(currentUser.profilePhotoUrl);
      if (oldPath) {
        try {
          await deleteFile(oldPath, PROFILE_PHOTOS_BUCKET);
        } catch {
          // Non-critical — old file may already be gone
        }
      }
    }

    // Upload new photo
    const { url } = await uploadFile(file, "uploads", PROFILE_PHOTOS_BUCKET);

    // Save URL to user record
    await prisma.user.update({
      where: { email: session.user.email },
      data: { profilePhotoUrl: url },
    });

    return NextResponse.json({ profilePhotoUrl: url });
  } catch (error) {
    console.error("Profile photo upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload photo. Please try again." },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/profile/photo
 *
 * Remove the user's profile photo.
 */
export async function DELETE() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { profilePhotoUrl: true },
    });

    // Delete from storage if it's a Supabase URL (skip base64 data URIs)
    if (user?.profilePhotoUrl && !user.profilePhotoUrl.startsWith("data:")) {
      const filePath = extractFilePathFromUrl(user.profilePhotoUrl);
      if (filePath) {
        try {
          await deleteFile(filePath);
        } catch {
          // Non-critical
        }
      }
    }

    await prisma.user.update({
      where: { email: session.user.email },
      data: { profilePhotoUrl: null },
    });

    return NextResponse.json({ profilePhotoUrl: null });
  } catch (error) {
    console.error("Profile photo delete error:", error);
    return NextResponse.json(
      { error: "Failed to remove photo." },
      { status: 500 },
    );
  }
}
