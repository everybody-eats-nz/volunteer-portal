import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { calculateYearStats } from "@/lib/year-in-review/stats-calculator";
import { isSeasonallyAvailable } from "@/lib/year-in-review/season-checker";
import {
  getCachedVideo,
  uploadVideo,
  cleanupOldVideos,
} from "@/lib/year-in-review/render-cache";
import {
  createJob,
  getActiveJob,
  startJob,
  updateJobProgress,
  completeJob,
  failJob,
} from "@/lib/year-in-review/job-tracker";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

const COMPOSITION_ID = "YearInReview";
const REMOTION_ROOT = path.join(process.cwd(), "src/remotion/index.ts");

/**
 * Render video asynchronously (runs in background)
 */
async function renderVideoAsync(jobId: string, userId: string, year: number) {
  try {
    // Mark job as processing
    startJob(jobId);

    // Calculate stats
    const stats = await calculateYearStats(userId, year);
    if (!stats) {
      failJob(jobId, "No volunteer activity found for this year");
      return;
    }

    updateJobProgress(jobId, 10);

    // Bundle Remotion composition
    console.log(`[Job ${jobId}] Bundling Remotion composition...`);
    const bundleLocation = await bundle({
      entryPoint: REMOTION_ROOT,
      webpackOverride: (config) => config,
    });

    updateJobProgress(jobId, 30);

    // Select composition
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: COMPOSITION_ID,
      inputProps: stats,
    });

    updateJobProgress(jobId, 40);

    // Create temporary output directory
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "remotion-"));
    const outputPath = path.join(tmpDir, "year-in-review.mp4");

    try {
      // Render video
      console.log(`[Job ${jobId}] Rendering video...`);
      await renderMedia({
        composition,
        serveUrl: bundleLocation,
        codec: "h264",
        outputLocation: outputPath,
        inputProps: stats,
        onProgress: ({ progress }) => {
          // Map render progress from 40% to 90%
          const mappedProgress = 40 + progress * 50;
          updateJobProgress(jobId, mappedProgress);
        },
      });

      updateJobProgress(jobId, 90);

      // Read rendered video
      const videoBuffer = await fs.readFile(outputPath);

      // Upload to Supabase cache
      console.log(`[Job ${jobId}] Uploading to cache...`);
      const uploaded = await uploadVideo(userId, year, videoBuffer);

      updateJobProgress(jobId, 95);

      // Clean up old videos for this user
      await cleanupOldVideos(userId);

      // Mark job as completed
      completeJob(jobId, uploaded.url);

      console.log(`[Job ${jobId}] Completed successfully`);

      // Clean up temporary files
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (renderError) {
      // Clean up temporary files on error
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      throw renderError;
    }
  } catch (error) {
    console.error(`[Job ${jobId}] Failed:`, error);
    failJob(
      jobId,
      error instanceof Error ? error.message : "Unknown render error"
    );
  }
}

/**
 * POST /api/year-in-review/render
 * Initiates rendering of a year-in-review video for the authenticated user
 *
 * Body: { year?: number }
 * Returns: { jobId: string, status: 'pending' | 'cached' }
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check seasonal availability
    if (!isSeasonallyAvailable()) {
      return NextResponse.json(
        {
          error:
            "Year-in-review videos are only available in December and January",
        },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const year = body.year || new Date().getFullYear() - 1; // Default to previous year

    // Check for cached video first
    const cachedVideo = await getCachedVideo(session.user.id, year);
    if (cachedVideo) {
      return NextResponse.json({
        status: "cached",
        url: cachedVideo.url,
        createdAt: cachedVideo.createdAt,
      });
    }

    // Check if there's already an active job for this user/year
    const activeJob = getActiveJob(session.user.id, year);
    if (activeJob) {
      return NextResponse.json({
        status: "processing",
        jobId: activeJob.id,
        progress: activeJob.progress,
      });
    }

    // Create new render job
    const job = createJob(session.user.id, year);

    // Start rendering asynchronously (don't await)
    renderVideoAsync(job.id, session.user.id, year).catch((error) => {
      console.error("Async render error:", error);
    });

    return NextResponse.json({
      status: "pending",
      jobId: job.id,
    });
  } catch (error) {
    console.error("Error initiating render:", error);
    return NextResponse.json(
      {
        error: "Failed to initiate render",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/year-in-review/render?year=2024
 * Check if a cached video exists for the user and year
 *
 * Query: year (optional, defaults to previous year)
 * Returns: { url: string, createdAt: Date } or 404
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check seasonal availability
    if (!isSeasonallyAvailable()) {
      return NextResponse.json(
        {
          error:
            "Year-in-review videos are only available in December and January",
        },
        { status: 403 }
      );
    }

    // Get year from query params
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const year = yearParam ? parseInt(yearParam) : new Date().getFullYear() - 1;

    // Check for cached video
    const cachedVideo = await getCachedVideo(session.user.id, year);
    if (!cachedVideo) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    return NextResponse.json({
      url: cachedVideo.url,
      createdAt: cachedVideo.createdAt,
    });
  } catch (error) {
    console.error("Error checking cached video:", error);
    return NextResponse.json(
      {
        error: "Failed to check cache",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
