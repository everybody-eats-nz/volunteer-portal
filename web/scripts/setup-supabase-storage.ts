/**
 * Setup script for Supabase Storage bucket for year-in-review videos
 * Run with: npx tsx scripts/setup-supabase-storage.ts
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing required environment variables:");
  console.error("  - NEXT_PUBLIC_SUPABASE_URL");
  console.error("  - SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BUCKET_NAME = "year-in-review-videos";

async function setupStorage() {
  console.log("Setting up Supabase Storage for year-in-review videos...\n");

  try {
    // Check if bucket exists
    const { data: buckets, error: listError } =
      await supabase.storage.listBuckets();

    if (listError) {
      throw new Error(`Failed to list buckets: ${listError.message}`);
    }

    const bucketExists = buckets?.some((b) => b.name === BUCKET_NAME);

    if (bucketExists) {
      console.log(`✓ Bucket "${BUCKET_NAME}" already exists`);
    } else {
      console.log(`Creating bucket "${BUCKET_NAME}"...`);

      const { error: createError } = await supabase.storage.createBucket(
        BUCKET_NAME,
        {
          public: true, // Videos can be accessed via public URL
          fileSizeLimit: 52428800, // 50MB limit
          allowedMimeTypes: ["video/mp4"],
        }
      );

      if (createError) {
        throw new Error(`Failed to create bucket: ${createError.message}`);
      }

      console.log(`✓ Created bucket "${BUCKET_NAME}"`);
    }

    // Set up RLS (Row Level Security) policies if needed
    // Note: Since we're using service role key for uploads and public access for viewing,
    // we don't need complex RLS policies. The bucket is public read.

    console.log("\nStorage setup completed successfully!");
    console.log("\nBucket configuration:");
    console.log(`  Name: ${BUCKET_NAME}`);
    console.log(`  Public: Yes`);
    console.log(`  Max file size: 50MB`);
    console.log(`  Allowed types: video/mp4`);
    console.log("\nPath structure: {userId}/{year}/year-in-review.mp4");
  } catch (error) {
    console.error("\n❌ Setup failed:");
    console.error(error);
    process.exit(1);
  }
}

setupStorage();
