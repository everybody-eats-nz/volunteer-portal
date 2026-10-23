"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";

/** GET/POST /api/year-in-review/video. */
export type ServerVideo = {
  status: "NONE" | "QUEUED" | "RENDERING" | "READY" | "FAILED";
  /** 0-100 while rendering. */
  progress: number;
  /** Videos queued before this one. */
  ahead: number;
  fileUrl: string | null;
};

const POLL_MS = 2500;

const isWorking = (video?: ServerVideo) =>
  video?.status === "QUEUED" || video?.status === "RENDERING";

/**
 * The server-rendered MP4 for the signed-in person, or for anyone when an
 * admin passes `userId` / `year`. `request()` asks for it; while it renders
 * the status is polled. Once it's ready and the device can share files, the
 * file is fetched in the background so Share opens instantly: browsers only
 * open the share sheet straight from a tap.
 */
export function useServerVideo(query: { userId?: string; year?: number } = {}) {
  const params = new URLSearchParams();
  if (query.userId) params.set("userId", query.userId);
  if (query.year) params.set("year", String(query.year));
  const url = `/api/year-in-review/video${params.size ? `?${params}` : ""}`;

  const { data, mutate, isLoading } = useSWR<ServerVideo>(url, {
    refreshInterval: (latest) => (isWorking(latest) ? POLL_MS : 0),
  });
  const [requestFailed, setRequestFailed] = useState(false);

  const request = async () => {
    setRequestFailed(false);
    try {
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await mutate((await res.json()) as ServerVideo, { revalidate: false });
    } catch {
      setRequestFailed(true);
    }
  };

  const shareFile = useShareableFile(data?.fileUrl ?? null);

  return {
    video: data,
    isLoading,
    working: isWorking(data),
    failed: requestFailed || data?.status === "FAILED",
    request,
    shareFile,
  };
}

function useShareableFile(fileUrl: string | null): File | null {
  const [file, setFile] = useState<{ url: string; file: File } | null>(null);

  useEffect(() => {
    if (!fileUrl || typeof navigator.canShare !== "function") return;
    let cancelled = false;
    fetch(fileUrl)
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (!blob || cancelled) return;
        const year = new URL(fileUrl, location.href).searchParams.get("year");
        const candidate = new File([blob], `year-in-mahi-${year}.mp4`, {
          type: "video/mp4",
        });
        if (navigator.canShare({ files: [candidate] })) {
          setFile({ url: fileUrl, file: candidate });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  return file?.url === fileUrl ? file.file : null;
}
