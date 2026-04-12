import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";
import { uploadFile, deleteFile, ALLOWED_FILE_TYPES, MAX_PROFILE_PHOTO_SIZE, PROFILE_PHOTOS_BUCKET } from "@/lib/storage";
import { extractFilePathFromUrl } from "@/lib/storage-utils";

/**
 * POST /api/mobile/profile/photo
 *
 * Upload a profile photo to Supabase Storage and save the URL.
 * Accepts multipart/form-data with a "photo" field.
 */
export async function POST(request: Request) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("photo") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No photo provided" }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_PROFILE_PHOTO_SIZE) {
      return NextResponse.json(
        { error: "Photo exceeds 1MB limit." },
        { status: 400 },
      );
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES.IMAGE.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Please use JPEG, PNG, or WebP." },
        { status: 400 },
      );
    }

    // Delete old photo from storage if it exists
    const currentUser = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { profilePhotoUrl: true },
    });

    if (currentUser?.profilePhotoUrl) {
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
      where: { id: auth.userId },
      data: { profilePhotoUrl: url },
    });

    return NextResponse.json({ image: url });
  } catch (error) {
    console.error("Profile photo upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload photo. Please try again." },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/mobile/profile/photo
 *
 * Remove the user's profile photo.
 */
export async function DELETE(request: Request) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { profilePhotoUrl: true },
    });

    // Delete from storage if it's a Supabase URL
    if (user?.profilePhotoUrl) {
      const filePath = extractFilePathFromUrl(user.profilePhotoUrl);
      if (filePath) {
        try {
          await deleteFile(filePath, PROFILE_PHOTOS_BUCKET);
        } catch {
          // Non-critical
        }
      }
    }

    // Clear from database
    await prisma.user.update({
      where: { id: auth.userId },
      data: { profilePhotoUrl: null },
    });

    return NextResponse.json({ image: null });
  } catch (error) {
    console.error("Profile photo delete error:", error);
    return NextResponse.json(
      { error: "Failed to remove photo." },
      { status: 500 },
    );
  }
}
