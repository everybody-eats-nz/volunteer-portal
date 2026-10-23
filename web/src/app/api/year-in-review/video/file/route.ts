import { NextResponse } from "next/server";
import { resolveVideoRequest } from "@/lib/year-in-review-access.server";
import { getReadyVideoPath } from "@/lib/year-in-review-render.server";
import { readVideo } from "@/lib/year-in-review-video-storage.server";

/**
 * GET /api/year-in-review/video/file
 *
 * The finished MP4, for its owner (or an admin). Served through here rather
 * than a storage URL because the bucket is private: the video has names and
 * friends' photos in it.
 */
export async function GET(request: Request) {
  const target = await resolveVideoRequest(request);
  if (target instanceof NextResponse) return target;

  const storagePath = await getReadyVideoPath(target.userId, target.year);
  const video = storagePath ? await readVideo(storagePath) : null;
  if (!video) {
    return NextResponse.json({ error: "Video not ready" }, { status: 404 });
  }

  return new Response(new Uint8Array(video), {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(video.byteLength),
      "Content-Disposition": `attachment; filename="year-in-mahi-${target.year}.mp4"`,
      // Personal, so never in a shared cache. The URL carries a version, so
      // the browser may keep it.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
