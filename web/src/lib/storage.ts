import { supabase, getSupabaseAdmin } from "./supabase";

export const STORAGE_BUCKET = "resource-hub";

// Allowed file types
export const ALLOWED_FILE_TYPES = {
  PDF: ["application/pdf"],
  IMAGE: ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"],
  DOCUMENT: [
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
};

// Max file size: 50MB
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * Upload a file to Supabase storage (uses service role for admin uploads)
 */
export async function uploadFile(
  file: File,
  folder: string = "uploads"
): Promise<{ url: string; path: string }> {
  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
  }

  // Generate unique file path
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const filePath = `${folder}/${timestamp}-${randomString}-${sanitizedFileName}`;

  // Use admin client for uploads (bypasses RLS policies)
  const admin = getSupabaseAdmin();

  // Upload to Supabase
  const { data, error } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    console.error("Supabase upload error:", error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  // Get public URL (can use regular client for this)
  const {
    data: { publicUrl },
  } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(data.path);

  return {
    url: publicUrl,
    path: data.path,
  };
}

/**
 * Delete a file from Supabase storage (admin only)
 */
export async function deleteFile(filePath: string): Promise<void> {
  const admin = getSupabaseAdmin();

  const { error } = await admin.storage.from(STORAGE_BUCKET).remove([filePath]);

  if (error) {
    console.error("Supabase delete error:", error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "";
}

/**
 * Validate file type based on resource type
 */
export function validateFileType(
  file: File,
  resourceType: "PDF" | "IMAGE" | "DOCUMENT"
): boolean {
  const allowedTypes = ALLOWED_FILE_TYPES[resourceType];
  return allowedTypes.includes(file.type);
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

/**
 * Extract file path from Supabase URL
 */
export function extractFilePathFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathMatch = urlObj.pathname.match(
      /\/storage\/v1\/object\/public\/[^/]+\/(.*)/
    );
    return pathMatch ? pathMatch[1] : null;
  } catch {
    return null;
  }
}
