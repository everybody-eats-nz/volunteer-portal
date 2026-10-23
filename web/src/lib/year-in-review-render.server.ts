import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import type { Prisma, YearInReviewVideo } from "@/generated/client";
import { getVolunteerYearInReview } from "@/lib/year-in-review.server";
import {
  deleteVideo,
  saveVideo,
} from "@/lib/year-in-review-video-storage.server";
import type { YearInReviewProps } from "@/remotion/year-in-review/schema";

/**
 * Server-side rendering of Year in mahi videos, inside the web container.
 *
 * Asking for a video queues a job row (YearInReviewVideo); a single in-process
 * loop renders queued jobs one at a time with Remotion and headless Chrome,
 * so a rush of requests never runs more than one render alongside the site.
 * Requests return straight away and the page polls: behind Cloudflare a
 * request can't wait the minute or so a render takes.
 *
 * A finished video is reused until the person's stats change. During the year
 * the Everybody Eats totals move daily, so a video under a day old is reused
 * regardless.
 */

/** Rendered video reused for this long even if the year's numbers moved. */
const REUSE_FOR_MS = 24 * 60 * 60 * 1000;
/** A render this old was cut off (a restart mid-render); take it again. */
const STALE_RENDER_MS = 15 * 60 * 1000;

/**
 * The Remotion bundle of src/remotion (`npm run video:bundle`), built in CI
 * and copied into the Docker image.
 */
const bundleDir = () =>
  process.env.YEAR_IN_REVIEW_BUNDLE_DIR ??
  path.join(/* turbopackIgnore: true */ process.cwd(), "remotion-bundle");

export type VideoJob = Pick<
  YearInReviewVideo,
  "status" | "progress" | "propsHash" | "renderedAt" | "updatedAt"
> & {
  /** Jobs queued before this one. */
  ahead: number;
};

export function hashProps(props: YearInReviewProps): string {
  return createHash("sha256").update(JSON.stringify(props)).digest("hex");
}

/** True when an existing job can stand in for one built from `hash`. */
export function canReuse(
  job: Pick<YearInReviewVideo, "status" | "propsHash" | "renderedAt">,
  hash: string,
  now: Date = new Date()
): boolean {
  if (job.status === "FAILED") return false;
  if (job.propsHash === hash) return true;
  return (
    job.status === "READY" &&
    job.renderedAt !== null &&
    now.getTime() - job.renderedAt.getTime() < REUSE_FOR_MS
  );
}

async function withQueuePosition(
  job: YearInReviewVideo | null
): Promise<VideoJob | null> {
  if (!job) return null;
  const ahead =
    job.status === "QUEUED"
      ? await prisma.yearInReviewVideo.count({
          where: { status: "QUEUED", updatedAt: { lt: job.updatedAt } },
        })
      : 0;
  return {
    status: job.status,
    progress: job.progress,
    propsHash: job.propsHash,
    renderedAt: job.renderedAt,
    updatedAt: job.updatedAt,
    ahead,
  };
}

/**
 * Makes sure a video is ready or on its way for this person and year.
 * Returns null when they have no completed shifts that year. Call
 * {@link drainRenderQueue} afterwards (in `after()`) to start rendering.
 */
export async function requestVideo(
  userId: string,
  year: number
): Promise<VideoJob | null> {
  const props = await getVolunteerYearInReview(userId, year);
  if (!props) return null;

  const hash = hashProps(props);
  const existing = await prisma.yearInReviewVideo.findUnique({
    where: { userId_year: { userId, year } },
  });
  if (existing && canReuse(existing, hash)) {
    return withQueuePosition(existing);
  }

  const job = await prisma.yearInReviewVideo.upsert({
    where: { userId_year: { userId, year } },
    create: {
      userId,
      year,
      props: props as Prisma.InputJsonValue,
      propsHash: hash,
    },
    // The previous file stays in storagePath until the new one replaces it.
    update: {
      status: "QUEUED",
      progress: 0,
      props: props as Prisma.InputJsonValue,
      propsHash: hash,
      error: null,
      startedAt: null,
    },
  });
  return withQueuePosition(job);
}

/** Where a video is up to, without changing anything. */
export async function getVideoJob(
  userId: string,
  year: number
): Promise<VideoJob | null> {
  return withQueuePosition(
    await prisma.yearInReviewVideo.findUnique({
      where: { userId_year: { userId, year } },
    })
  );
}

/** The finished file's location, when there is one. */
export async function getReadyVideoPath(
  userId: string,
  year: number
): Promise<string | null> {
  const job = await prisma.yearInReviewVideo.findUnique({
    where: { userId_year: { userId, year } },
    select: { status: true, storagePath: true },
  });
  return job?.status === "READY" ? job.storagePath : null;
}

/** True while there's queued (or abandoned) work for the loop to pick up. */
export async function hasPendingRenders(): Promise<boolean> {
  return (await nextJob()) !== null;
}

function nextJob() {
  return prisma.yearInReviewVideo.findFirst({
    where: {
      OR: [
        { status: "QUEUED" },
        {
          status: "RENDERING",
          startedAt: { lt: new Date(Date.now() - STALE_RENDER_MS) },
        },
      ],
    },
    orderBy: { updatedAt: "asc" },
  });
}

let draining: Promise<void> | null = null;

/**
 * Renders queued videos one at a time until none are left. Safe to call as
 * often as you like: a second call joins the loop already running.
 */
export function drainRenderQueue(): Promise<void> {
  draining ??= (async () => {
    try {
      while (await renderNextJob()) {
        // Keep going until the queue is empty.
      }
    } catch (error) {
      console.error("Year in mahi render queue stopped", error);
    } finally {
      draining = null;
    }
  })();
  return draining;
}

/** Renders one job. Returns false when there was nothing to do. */
async function renderNextJob(): Promise<boolean> {
  const job = await nextJob();
  if (!job) return false;

  // Claim it with a compare-and-set: if anything (another claim, a re-queue
  // with new props) changed the row since we read it, this matches nothing.
  const claimed = await prisma.yearInReviewVideo.updateMany({
    where: {
      id: job.id,
      status: job.status,
      propsHash: job.propsHash,
      updatedAt: job.updatedAt,
    },
    data: { status: "RENDERING", startedAt: new Date(), progress: 0 },
  });
  if (claimed.count === 0) return true;

  const storagePath = `${job.userId}/${job.year}-${job.propsHash.slice(0, 16)}.mp4`;
  const workDir = await mkdtemp(path.join(os.tmpdir(), "year-in-review-"));
  // The file the row already points at must survive whatever happens here.
  const discard = () =>
    storagePath === job.storagePath
      ? Promise.resolve()
      : deleteVideo(storagePath).catch(() => {});
  let uploaded = false;
  try {
    const file = path.join(workDir, "video.mp4");
    // Progress for the waiting screen, written in 5% steps.
    let saved = 0;
    await renderVideo(job.props as YearInReviewProps, file, (percent) => {
      if (percent < saved + 5) return;
      saved = percent;
      prisma.yearInReviewVideo
        .updateMany({
          where: { id: job.id, propsHash: job.propsHash },
          data: { progress: percent },
        })
        .catch(() => {});
    });
    await saveVideo(storagePath, await readFile(file));
    uploaded = true;

    // Only finish it if nobody re-queued it with newer numbers meanwhile.
    const finished = await prisma.yearInReviewVideo.updateMany({
      where: { id: job.id, propsHash: job.propsHash },
      data: {
        status: "READY",
        progress: 100,
        storagePath,
        renderedAt: new Date(),
        error: null,
      },
    });
    if (finished.count === 0) {
      await discard();
    } else if (job.storagePath && job.storagePath !== storagePath) {
      await deleteVideo(job.storagePath).catch(() => {});
    }
  } catch (error) {
    console.error(`Year in mahi render failed for ${job.id}`, error);
    // Uploaded but never recorded: nothing would ever point at it.
    if (uploaded) await discard();
    await prisma.yearInReviewVideo.updateMany({
      where: { id: job.id, propsHash: job.propsHash },
      data: {
        status: "FAILED",
        error: String(error instanceof Error ? error.message : error).slice(
          0,
          500
        ),
      },
    });
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
  return true;
}

async function renderVideo(
  props: YearInReviewProps,
  outputLocation: string,
  onPercent: (percent: number) => void
) {
  // Loaded on first render only: it's large and server-only.
  const { renderMedia, selectComposition } = await import("@remotion/renderer");
  const serveUrl = bundleDir();
  const composition = await selectComposition({
    serveUrl,
    id: "YearInReview",
    inputProps: props,
    logLevel: "warn",
  });
  await renderMedia({
    composition,
    serveUrl,
    inputProps: props,
    outputLocation,
    codec: "h264",
    pixelFormat: "yuv420p",
    imageFormat: "jpeg",
    jpegQuality: 90,
    // Music and sound effects only: 128k AAC is plenty.
    audioBitrate: "128k",
    // Leave half the CPUs to the site while a video renders.
    concurrency: Math.max(1, Math.floor(os.availableParallelism() / 2)),
    logLevel: "warn",
    onProgress: ({ progress }) => onPercent(Math.floor(progress * 100)),
    // Everybody Eats is a registered charity, under Remotion's free licence.
    licenseKey: "free-license",
  });
}
