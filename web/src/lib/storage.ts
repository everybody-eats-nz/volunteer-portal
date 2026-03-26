import { supabase, getSupabaseAdmin } from "./supabase";
import {
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZE,
  getFileExtension,
} from "./storage-utils";

export {
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZE,
  getFileExtension,
  formatFileSize,
  extractFilePathFromUrl,
} from "./storage-utils";

export const STORAGE_BUCKET = "resource-hub";
export const PROFILE_PHOTOS_BUCKET = "profile-photos";

/**
 * Upload a file to Supabase storage (uses service role for admin uploads)
 */
export async function uploadFile(
  file: File,
  folder: string = "uploads",
  bucket: string = STORAGE_BUCKET
): Promise<{ url: string; path: string }> {
  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
  }

  // Generate unique file path
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);

  // Extract file extension and base name
  const fileExtension = getFileExtension(file.name);
  const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

  // Sanitize base name more strictly for Supabase compatibility
  // - Replace all non-alphanumeric characters (except hyphens/underscores) with underscores
  // - Remove multiple consecutive underscores/hyphens
  // - Remove leading/trailing underscores/hyphens
  const sanitizedBaseName = baseName
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/[_-]+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "")
    .toLowerCase();

  // Build filename with sanitized name and original extension
  const sanitizedFileName = fileExtension
    ? `${sanitizedBaseName}.${fileExtension}`
    : sanitizedBaseName;

  // Ensure we have a valid filename after sanitization
  if (!sanitizedBaseName) {
    throw new Error(
      "Invalid filename: could not generate a valid name from the file. Please rename your file with alphanumeric characters."
    );
  }

  const filePath = `${folder}/${timestamp}-${randomString}-${sanitizedFileName}`;

  // Use admin client for uploads (bypasses RLS policies)
  const admin = getSupabaseAdmin();

  // Upload to Supabase
  const { data, error } = await admin.storage
    .from(bucket)
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
  } = supabase.storage.from(bucket).getPublicUrl(data.path);

  return {
    url: publicUrl,
    path: data.path,
  };
}

/**
 * Delete a file from Supabase storage (admin only)
 */
export async function deleteFile(filePath: string, bucket: string = STORAGE_BUCKET): Promise<void> {
  const admin = getSupabaseAdmin();

  const { error } = await admin.storage.from(bucket).remove([filePath]);

  if (error) {
    console.error("Supabase delete error:", error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
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
