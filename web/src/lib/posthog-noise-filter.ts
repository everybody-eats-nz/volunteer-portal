/**
 * Filters out exception events that originate from browser extensions, scripts
 * the browser injects into the page, or opaque cross-origin scripts rather than
 * our own code. These add noise to PostHog
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

/** A stack frame as posthog-js records it (`$exception_list[].stacktrace.frames[]`). */
interface StackFrame {
  filename?: unknown;
  lineno?: unknown;
}

const SCRIPT_FILE_EXTENSION = /\.(m|c)?jsx?$/i;

/** The origin of the page we are running on, or undefined outside a browser. */
function currentPageOrigin(): string | undefined {
  return typeof window === "undefined" ? undefined : window.location.origin;
}

/**
 * True when a frame points at line 2 or later of one of our own HTML pages
 * rather than at a script file.
 *
 * Next.js renders the whole document, inline scripts included, on a single
 * line, and all of our own code is served from `/_next/` script files. So a
 * frame on line 2+ of one of our page URLs can only come from script the
 * browser injected into the page itself. Chrome for iOS does this: its
 * Closure-minified helpers (autofill, translate, etc.) run as user scripts that
 * report the page URL as their source, and occasionally recurse until "Maximum
 * call stack size exceeded" (issues #1397, #1195, #1235) or throw minified
 * messages such as "Ma" / "Ba" (issues #1398, #1196). None of that is fixable
 * from our code.
 *
 * The single-line document was confirmed against production on Next 16
 * (2026-11, issue #1397). Re-check it after a Next.js upgrade: this should
 * print 1, and if it prints more, this rule would hide real inline-script
 * errors and needs revisiting:
 *   curl -s https://volunteers.everybodyeats.nz/volunteer/wellington | wc -l
 *
 * Frames on other origins are never treated as injected: a third-party script
 * served from an extension-less path (e.g. `/gtag/js`) is a real script file.
 */
function isInjectedDocumentFrame(
  frame: StackFrame,
  pageOrigin: string | undefined
): boolean {
  if (typeof frame.lineno !== "number" || frame.lineno <= 1) return false;
  if (typeof frame.filename !== "string") return false;

  let pathname: string;
  try {
    const url = new URL(frame.filename);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (!pageOrigin || url.origin !== pageOrigin) return false;
    pathname = url.pathname;
  } catch {
    // PostHog sometimes stores the path alone, which is relative to the page.
    if (!frame.filename.startsWith("/")) return false;
    pathname = frame.filename.split(/[?#]/)[0];
  }

  if (pathname.startsWith("/_next/")) return false;
  return !SCRIPT_FILE_EXTENSION.test(pathname);
}

function getStackFrames(exception: unknown): StackFrame[] {
  if (!exception || typeof exception !== "object") return [];
  const stacktrace = (exception as { stacktrace?: unknown }).stacktrace;
  if (!stacktrace || typeof stacktrace !== "object") return [];
  const frames = (stacktrace as { frames?: unknown }).frames;
  if (!Array.isArray(frames)) return [];
  return frames.filter(
    (frame): frame is StackFrame => !!frame && typeof frame === "object"
  );
}

/**
 * True when every exception in the event carries a stack trace and every frame
 * of it comes from script the browser injected into the page (see
 * `isInjectedDocumentFrame`). If any exception in the chain has no frames, the
 * event is kept: there is nothing to judge that exception by, and it may be
 * ours.
 */
export function isBrowserInjectedException(
  event: InspectableEvent,
  pageOrigin: string | undefined = currentPageOrigin()
): boolean {
  const list = event.properties?.$exception_list;
  if (!Array.isArray(list) || list.length === 0) return false;

  return list.every((exception) => {
    const frames = getStackFrames(exception);
    return (
      frames.length > 0 &&
      frames.every((frame) => isInjectedDocumentFrame(frame, pageOrigin))
    );
  });
}

/**
 * True when the event is an exception that is known noise and should be
 * dropped before sending to PostHog: either its message matches a known-noise
 * pattern, or its whole stack comes from browser-injected script.
 */
export function isNoiseException(
  event: InspectableEvent,
  pageOrigin: string | undefined = currentPageOrigin()
): boolean {
  if (event.event !== "$exception") return false;
  const messageIsNoise = getExceptionMessages(event).some((message) =>
    NOISE_EXCEPTION_PATTERNS.some((pattern) => pattern.test(message))
  );
  return messageIsNoise || isBrowserInjectedException(event, pageOrigin);
}
