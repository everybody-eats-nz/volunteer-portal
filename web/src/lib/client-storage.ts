"use client";

import { supabase } from "./supabase";
import {
  STORAGE_BUCKET,
  MAX_FILE_SIZE,
  validateFileType,
  getFileExtension,
} from "./storage";

/**
 * Client-side file upload directly to Supabase Storage
 * This bypasses Next.js API route limits and enables larger uploads
 */
export async function uploadFileFromClient(
  file: File,
  resourceType: "PDF" | "IMAGE" | "DOCUMENT",
  folder: string = "resources"
): Promise<{ url: string; path: string; fileName: string; fileSize: number }> {
  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
  }

  // Validate file type
  if (!validateFileType(file, resourceType)) {
    throw new Error("Invalid file type for selected resource type");
  }

  // Extract file extension and base name
  const fileExtension = getFileExtension(file.name);
  const baseName = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;

  // Sanitize base name for Supabase compatibility
  const sanitizedBaseName = baseName
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/[_-]+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "")
    .toLowerCase();

  if (!sanitizedBaseName) {
    throw new Error(
      "Invalid filename: could not generate a valid name from the file. Please rename your file with alphanumeric characters."
    );
  }

  // Truncate filename if too long (max 100 chars)
  const maxBaseNameLength = 100;
  const truncatedBaseName =
    sanitizedBaseName.length > maxBaseNameLength
      ? sanitizedBaseName.substring(0, maxBaseNameLength)
      : sanitizedBaseName;

  const finalFileName = fileExtension
    ? `${truncatedBaseName}.${fileExtension}`
    : truncatedBaseName;

  // Generate unique file path
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  const filePath = `${folder}/${timestamp}-${randomString}-${finalFileName}`;

  console.log("Client-side upload:", {
    originalName: file.name,
    sanitizedName: finalFileName,
    fullPath: filePath,
    fileSize: file.size,
    fileType: file.type,
  });

  // Upload to Supabase Storage
  // Note: This requires appropriate RLS policies for authenticated users
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    console.error("Supabase upload error:", error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(data.path);

  return {
    url: publicUrl,
    path: data.path,
    fileName: file.name,
    fileSize: file.size,
  };
}

/**
 * Delete file from client (requires appropriate RLS policies)
 */
export async function deleteFileFromClient(filePath: string): Promise<void> {
  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([filePath]);

  if (error) {
    console.error("Supabase delete error:", error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}
