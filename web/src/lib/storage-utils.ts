/**
 * Pure utility functions extracted from storage.ts
 * These don't depend on Supabase and can be safely imported anywhere
 */

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

// Max file size: 4MB (Vercel serverless function payload limit)
export const MAX_FILE_SIZE = 4 * 1024 * 1024;

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "";
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
