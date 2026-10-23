"use client";

import { Download, Loader2, Share2, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useServerVideo, type ServerVideo } from "./use-server-video";

/**
 * Gets the MP4 the volunteer can keep or post. The server renders it (about a
 * minute, one at a time), so they can leave and come back to a finished
 * video. Admins pass `userId` / `year` to get someone else's.
 */
export function YearInReviewSharePanel({
  year,
  userId,
  heading = "Share your year",
}: {
  readonly year: number;
  readonly userId?: string;
  readonly heading?: string;
}) {
  const { video, isLoading, working, failed, request, shareFile } =
    useServerVideo(userId ? { userId, year } : {});

  const share = async (file: File) => {
    try {
      await navigator.share({ files: [file], title: `My ${year} in mahi` });
    } catch (error) {
      // Closing the share sheet isn't a failure.
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Couldn't open sharing. Download the video instead.");
    }
  };

  return (
    <section
      aria-labelledby="year-in-review-share-heading"
      data-testid="year-in-review-share-panel"
      className="rounded-3xl border border-forest-500/15 bg-card-bg p-6 sm:p-8 dark:border-cream-50/12"
    >
      <h2
        id="year-in-review-share-heading"
        className="display text-3xl leading-tight text-forest-700 dark:text-cream-50"
      >
        {heading}
      </h2>
      <p className="mt-3 max-w-prose text-muted-foreground">
        An MP4 sized for Instagram Stories and Reels.
      </p>

      <div className="mt-6" aria-live="polite">
        {isLoading ? (
          <Skeleton className="h-11 w-44 rounded-full" />
        ) : working && video ? (
          <Making video={video} />
        ) : video?.status === "READY" && video.fileUrl ? (
          <Ready
            fileUrl={video.fileUrl}
            shareFile={shareFile}
            onShare={share}
          />
        ) : (
          <div className="space-y-3">
            {failed && (
              <p className="text-sm text-destructive" role="alert">
                Something went wrong making the video. Try again.
              </p>
            )}
            <Button
              size="lg"
              onClick={request}
              data-testid="year-in-review-export-button"
            >
              <Video aria-hidden />
              {failed ? "Try again" : "Get the video"}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

function Making({ video }: { readonly video: ServerVideo }) {
  const queued = video.status === "QUEUED";
  return (
    <div className="space-y-3" data-testid="year-in-review-export-progress">
      <div className="flex items-center justify-between gap-4 text-sm font-medium">
        <span className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {queued
            ? video.ahead > 0
              ? `Waiting for ${video.ahead} other ${video.ahead === 1 ? "video" : "videos"} to finish`
              : "Getting started"
            : "Making your video"}
        </span>
        {!queued && <span className="tabular-nums">{video.progress}%</span>}
      </div>
      <Progress
        value={queued ? 0 : video.progress}
        aria-label="Video progress"
      />
      <p className="text-sm text-muted-foreground">
        It takes about a minute. You can leave this page; it&apos;ll be here
        when you come back.
      </p>
    </div>
  );
}

function Ready({
  fileUrl,
  shareFile,
  onShare,
}: {
  readonly fileUrl: string;
  readonly shareFile: File | null;
  readonly onShare: (file: File) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-forest-700 dark:text-cream-50">
        Your video is ready.
      </p>
      <div className="flex flex-wrap gap-3">
        {shareFile && (
          <Button
            size="lg"
            onClick={() => onShare(shareFile)}
            data-testid="year-in-review-share-button"
          >
            <Share2 aria-hidden />
            Share
          </Button>
        )}
        <Button
          asChild
          size="lg"
          variant={shareFile ? "outline" : "default"}
          data-testid="year-in-review-download-button"
        >
          <a href={fileUrl} download>
            <Download aria-hidden />
            Download
          </a>
        </Button>
      </div>
    </div>
  );
}
