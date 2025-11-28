import { useState, useEffect, useCallback, useRef } from "react";

export type RenderStatus = "idle" | "checking" | "rendering" | "completed" | "failed";

export interface UseYearInReviewRenderResult {
  status: RenderStatus;
  progress: number;
  videoUrl: string | null;
  error: string | null;
  startRender: (year?: number) => Promise<void>;
  reset: () => void;
  isLoading: boolean;
}

const POLL_INTERVAL_MS = 2000; // Poll every 2 seconds

export function useYearInReviewRender(): UseYearInReviewRenderResult {
  const [status, setStatus] = useState<RenderStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentJobIdRef = useRef<string | null>(null);

  // Clear polling timeout
  const clearPollTimeout = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  // Poll job status
  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const response = await fetch(`/api/year-in-review/job/${jobId}`);

      if (!response.ok) {
        throw new Error("Failed to fetch job status");
      }

      const data = await response.json();

      setProgress(data.progress || 0);

      if (data.status === "completed") {
        setStatus("completed");
        setVideoUrl(data.videoUrl);
        setProgress(100);
        clearPollTimeout();
      } else if (data.status === "failed") {
        setStatus("failed");
        setError(data.error || "Render failed");
        clearPollTimeout();
      } else {
        // Continue polling
        pollTimeoutRef.current = setTimeout(() => {
          pollJobStatus(jobId);
        }, POLL_INTERVAL_MS);
      }
    } catch (err) {
      setStatus("failed");
      setError(err instanceof Error ? err.message : "Failed to check render status");
      clearPollTimeout();
    }
  }, [clearPollTimeout]);

  // Start rendering
  const startRender = useCallback(async (year?: number) => {
    try {
      setStatus("checking");
      setError(null);
      setProgress(0);
      setVideoUrl(null);

      // Initiate render
      const response = await fetch("/api/year-in-review/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to start render");
      }

      const data = await response.json();

      if (data.status === "cached") {
        // Video already exists
        setStatus("completed");
        setVideoUrl(data.url);
        setProgress(100);
      } else if (data.status === "processing") {
        // Job already in progress
        setStatus("rendering");
        setProgress(data.progress || 0);
        currentJobIdRef.current = data.jobId;
        pollJobStatus(data.jobId);
      } else {
        // New job created
        setStatus("rendering");
        currentJobIdRef.current = data.jobId;
        pollJobStatus(data.jobId);
      }
    } catch (err) {
      setStatus("failed");
      setError(err instanceof Error ? err.message : "Failed to start render");
    }
  }, [pollJobStatus]);

  // Reset state
  const reset = useCallback(() => {
    clearPollTimeout();
    currentJobIdRef.current = null;
    setStatus("idle");
    setProgress(0);
    setVideoUrl(null);
    setError(null);
  }, [clearPollTimeout]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearPollTimeout();
    };
  }, [clearPollTimeout]);

  return {
    status,
    progress,
    videoUrl,
    error,
    startRender,
    reset,
    isLoading: status === "checking" || status === "rendering",
  };
}
