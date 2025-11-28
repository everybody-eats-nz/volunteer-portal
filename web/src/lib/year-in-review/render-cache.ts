import { getSupabaseAdmin } from "@/lib/supabase";

const BUCKET_NAME = "year-in-review-videos";
const CACHE_EXPIRY_DAYS = 365; // Videos cached for 1 year

export interface CachedVideo {
  url: string;
  path: string;
  createdAt: Date;
}

/**
 * Initialize Supabase storage bucket for year-in-review videos
 * This should be called during setup (bucket should already exist)
 */
export async function ensureBucketExists(): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some((b) => b.name === BUCKET_NAME);

  if (!bucketExists) {
    const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 52428800, // 50MB limit
      allowedMimeTypes: ["video/mp4"],
    });

    if (error) {
      throw new Error(`Failed to create storage bucket: ${error.message}`);
    }
  }
}

/**
 * Generate cache key for a user's year-in-review video
 */
export function getCacheKey(userId: string, year: number): string {
  return `${userId}/${year}/year-in-review.mp4`;
}

/**
 * Check if a cached video exists for this user and year
 */
export async function getCachedVideo(
  userId: string,
  year: number
): Promise<CachedVideo | null> {
  const supabase = getSupabaseAdmin();
  const path = getCacheKey(userId, year);

  // Check if file exists
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(`${userId}/${year}`, {
      limit: 1,
      search: "year-in-review.mp4",
    });

  if (error || !data || data.length === 0) {
    return null;
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(path);

  if (!urlData?.publicUrl) {
    return null;
  }

  // Get file metadata to check age
  const file = data[0];
  const createdAt = new Date(file.created_at);
  const ageInDays =
    (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

  // If cache is expired, delete it
  if (ageInDays > CACHE_EXPIRY_DAYS) {
    await deleteCachedVideo(userId, year);
    return null;
  }

  return {
    url: urlData.publicUrl,
    path,
    createdAt,
  };
}

/**
 * Upload a rendered video to cache
 */
export async function uploadVideo(
  userId: string,
  year: number,
  videoBuffer: Buffer
): Promise<CachedVideo> {
  const supabase = getSupabaseAdmin();
  const path = getCacheKey(userId, year);

  // Delete existing video if any
  await deleteCachedVideo(userId, year);

  // Upload new video
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, videoBuffer, {
      contentType: "video/mp4",
      cacheControl: "3600",
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload video: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(path);

  if (!urlData?.publicUrl) {
    throw new Error("Failed to get public URL for uploaded video");
  }

  return {
    url: urlData.publicUrl,
    path,
    createdAt: new Date(),
  };
}

/**
 * Delete a cached video
 */
export async function deleteCachedVideo(
  userId: string,
  year: number
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const path = getCacheKey(userId, year);

  const { error } = await supabase.storage.from(BUCKET_NAME).remove([path]);

  if (error && error.message !== "Object not found") {
    throw new Error(`Failed to delete cached video: ${error.message}`);
  }
}

/**
 * Clean up old cached videos for a user (keep only most recent year)
 */
export async function cleanupOldVideos(userId: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  // List all videos for this user
  const { data: files, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(userId, {
      limit: 100,
    });

  if (error || !files || files.length === 0) {
    return;
  }

  // Get current year
  const currentYear = new Date().getFullYear();

  // Delete videos older than current year
  const filesToDelete = files
    .filter((file) => {
      const yearMatch = file.name.match(/(\d{4})/);
      if (!yearMatch) return false;
      const year = parseInt(yearMatch[1]);
      return year < currentYear;
    })
    .map((file) => `${userId}/${file.name}`);

  if (filesToDelete.length > 0) {
    await supabase.storage.from(BUCKET_NAME).remove(filesToDelete);
  }
}
