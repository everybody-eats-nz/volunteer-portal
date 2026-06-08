import posthog from "posthog-js";
import { installDomTranslationGuard } from "@/lib/dom-translation-guard";

// Protect React from in-browser translation extensions that mutate the DOM
// (Google Translate etc.) and otherwise crash the page. Runs before hydration.
installDomTranslationGuard();

/**
 * Exception messages that originate from browser extensions or opaque
 * cross-origin scripts — not from our code. They add noise to error tracking
 * (and inflate week-over-week trends) without being actionable, so we drop them
 * before they're sent to PostHog.
 */
const NOISE_EXCEPTION_PATTERNS: RegExp[] = [
  // Outlook "Safe Links" / other extension content-script injectors.
  /Object Not Found Matching Id:\d+, MethodName:update/i,
  // Opaque cross-origin script errors — no actionable stack trace.
  // (Some browsers append "(line 0)" etc., so this isn't anchored at the end.)
  /^Script error\.?/i,
  // Benign browser layout notifications, not real errors.
  /ResizeObserver loop (limit exceeded|completed with undelivered notifications)/i,
];

function isNoiseException(event: {
  event: string;
  properties?: Record<string, unknown>;
}): boolean {
  if (event.event !== "$exception") return false;

  const props = event.properties ?? {};
  const values: string[] = [];

  const list = props.$exception_list;
  if (Array.isArray(list)) {
    for (const item of list) {
      if (item && typeof item === "object" && "value" in item) {
        const value = (item as { value?: unknown }).value;
        if (typeof value === "string") values.push(value);
      }
    }
  }

  const exceptionValues = props.$exception_values;
  if (Array.isArray(exceptionValues)) {
    for (const value of exceptionValues) {
      if (typeof value === "string") values.push(value);
    }
  }

  return values.some((value) =>
    NOISE_EXCEPTION_PATTERNS.some((pattern) => pattern.test(value))
  );
}

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  defaults: "2025-05-24",
  before_send: (event) => {
    if (event && isNoiseException(event)) return null;
    return event;
  },
});
