/**
 * Filters out exception events that originate from browser extensions or opaque
 * cross-origin scripts rather than our own code. These add noise to PostHog
 * error tracking (and inflate week-over-week trends) without being actionable,
 * so they are dropped client-side before being sent.
 *
 * Used by `instrumentation-client.ts` as a PostHog `before_send` predicate.
 */

export const NOISE_EXCEPTION_PATTERNS: RegExp[] = [
  // Outlook "Safe Links" / other extension content-script injectors.
  /Object Not Found Matching Id:\d+, MethodName:update/i,
  // Opaque cross-origin script errors — no actionable stack trace.
  // (Some browsers append "(line 0)" etc., so this isn't anchored at the end.)
  /^Script error\.?/i,
  // Benign browser layout notifications, not real errors.
  /ResizeObserver loop (limit exceeded|completed with undelivered notifications)/i,
];

/** Minimal structural shape of a PostHog capture event we need to inspect. */
export interface InspectableEvent {
  event: string;
  properties?: Record<string, unknown>;
}

/**
 * Pulls every exception message string out of a PostHog `$exception` event,
 * looking at both the structured `$exception_list[].value` entries and the
 * flat `$exception_values` array.
 */
export function getExceptionMessages(event: InspectableEvent): string[] {
  const props = event.properties ?? {};
  const messages: string[] = [];

  const list = props.$exception_list;
  if (Array.isArray(list)) {
    for (const item of list) {
      if (item && typeof item === "object" && "value" in item) {
        const value = (item as { value?: unknown }).value;
        if (typeof value === "string") messages.push(value);
      }
    }
  }

  const exceptionValues = props.$exception_values;
  if (Array.isArray(exceptionValues)) {
    for (const value of exceptionValues) {
      if (typeof value === "string") messages.push(value);
    }
  }

  return messages;
}

/**
 * True when the event is an exception whose message matches a known-noise
 * pattern and should be dropped before sending to PostHog.
 */
export function isNoiseException(event: InspectableEvent): boolean {
  if (event.event !== "$exception") return false;
  return getExceptionMessages(event).some((message) =>
    NOISE_EXCEPTION_PATTERNS.some((pattern) => pattern.test(message))
  );
}
