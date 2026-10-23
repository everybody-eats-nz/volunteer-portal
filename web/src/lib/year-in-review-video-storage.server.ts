import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * Where finished Year in mahi MP4s live.
 *
 * A private Supabase Storage bucket when Supabase is configured (production):
 * the videos carry names and friends' photos, so they are never public and
 * are only served through the auth-checked /api/year-in-review/video/file
 * route. Without Supabase (local dev, CI) they go to a local directory, which
 * is fine for a cache: a missing file just means rendering again.
 */

const BUCKET = "year-in-review";

const localDir = () =>
  process.env.YEAR_IN_REVIEW_VIDEO_DIR ??
  path.join(os.tmpdir(), "year-in-review-videos");

function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// Imported lazily: lib/supabase throws at import time when it isn't configured.
async function bucket() {
  const { getSupabaseAdmin } = await import("@/lib/supabase");
  return getSupabaseAdmin().storage;
}

export async function saveVideo(storagePath: string, data: Buffer) {
  if (!supabaseConfigured()) {
    const file = path.join(localDir(), storagePath);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data);
    return;
  }

  const storage = await bucket();
  const upload = () =>
    storage.from(BUCKET).upload(storagePath, data, {
      contentType: "video/mp4",
      upsert: true,
    });
  let { error } = await upload();
  // First video ever: create the private bucket, then try again.
  if (error && /not found/i.test(error.message)) {
    await storage.createBucket(BUCKET, { public: false });
    ({ error } = await upload());
  }
  if (error) throw new Error(`Video upload failed: ${error.message}`);
}

export async function readVideo(storagePath: string): Promise<Buffer | null> {
  if (!supabaseConfigured()) {
    return readFile(path.join(localDir(), storagePath)).catch(() => null);
  }
  const { data, error } = await (await bucket())
    .from(BUCKET)
    .download(storagePath);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

export async function deleteVideo(storagePath: string) {
  if (!supabaseConfigured()) {
    await rm(path.join(localDir(), storagePath), { force: true });
    return;
  }
  await (await bucket()).from(BUCKET).remove([storagePath]);
}
