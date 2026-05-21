import type { Instrumentation } from "next";

export function register() {
  // No-op for initialization. PostHog server client is lazily created in
  // src/lib/posthog-server.ts on first use.
}

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

  const { getPostHogServer } = await import("./src/lib/posthog-server");
  const posthog = getPostHogServer();

  // Pull PostHog's anonymous distinct_id from the cookie so the exception
  // is attributed to the same person as their browser events.
  let distinctId: string | undefined;
  const cookieHeader = request.headers.cookie;
  if (cookieHeader) {
    const cookieString = Array.isArray(cookieHeader)
      ? cookieHeader.join("; ")
      : cookieHeader;
    const match = cookieString.match(/ph_phc_.*?_posthog=([^;]+)/);
    if (match?.[1]) {
      try {
        const decoded = decodeURIComponent(match[1]);
        const parsed = JSON.parse(decoded) as { distinct_id?: string };
        distinctId = parsed.distinct_id;
      } catch {
        // Malformed cookie — fall through and capture without a distinct id.
      }
    }
  }

  posthog.captureException(
    err instanceof Error ? err : new Error(String(err)),
    distinctId,
  );
};
