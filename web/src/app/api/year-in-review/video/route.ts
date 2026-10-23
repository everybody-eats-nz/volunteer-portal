import { after, NextResponse } from "next/server";
import {
  resolveVideoRequest,
  videoFileUrl,
} from "@/lib/year-in-review-access.server";
import {
  drainRenderQueue,
  getVideoJob,
  requestVideo,
  type VideoJob,
} from "@/lib/year-in-review-render.server";

/**
 * The Year in mahi MP4, rendered on the server.
 *
 * POST asks for it (queues a render unless an up-to-date one exists); GET
 * reports progress for polling. Both answer straight away and render after
 * the response, one video at a time. Session (web) or bearer token (app);
 * admins may pass ?userId= and ?year=. See lib/year-in-review-render.server.
 */

function respond(userId: string, year: number, job: VideoJob | null) {
  if (job && (job.status === "QUEUED" || job.status === "RENDERING")) {
    // Picks the work up (or joins the loop already running) after replying.
    after(() => drainRenderQueue());
  }
  return NextResponse.json({
    status: job?.status ?? "NONE",
    progress: job?.progress ?? 0,
    ahead: job?.ahead ?? 0,
    fileUrl:
      job?.status === "READY"
        ? videoFileUrl(userId, year, job.propsHash)
        : null,
  });
}

export async function GET(request: Request) {
  const target = await resolveVideoRequest(request);
  if (target instanceof NextResponse) return target;
  return respond(
    target.userId,
    target.year,
    await getVideoJob(target.userId, target.year)
  );
}

export async function POST(request: Request) {
  const target = await resolveVideoRequest(request);
  if (target instanceof NextResponse) return target;

  const job = await requestVideo(target.userId, target.year);
  if (!job) {
    return NextResponse.json(
      { error: `No completed shifts in ${target.year}` },
      { status: 404 }
    );
  }
  return respond(target.userId, target.year, job);
}
