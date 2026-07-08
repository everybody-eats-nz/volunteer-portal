import type { Instrumentation } from "next";

export async function register() {
  // PostHog server client is lazily created in src/lib/posthog-server.ts on
  // first use. Here we only wire up LLM analytics: the AI SDK emits gen_ai.*
  // OpenTelemetry spans (via experimental_telemetry on streamText /
  // generateText), and PostHogSpanProcessor ships them to PostHog as
  // $ai_generation events with tokens, latency, and cost.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

  const { NodeSDK } = await import("@opentelemetry/sdk-node");
  const { resourceFromAttributes } = await import("@opentelemetry/resources");
  const { PostHogSpanProcessor } = await import("@posthog/ai/otel");

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      "service.name": "volunteer-portal",
    }),
    spanProcessors: [
      new PostHogSpanProcessor({
        projectToken: process.env.NEXT_PUBLIC_POSTHOG_KEY,
        host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      }),
    ],
  });
  sdk.start();
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
