import { ApiError } from "@/lib/api";

/**
 * Why a screen's data failed to load, so the screen can say something useful:
 *
 * - `not-found`: the thing is gone (404). Retrying will not help; offer a way back.
 * - `offline`: the request never reached the server (no network, DNS, timeout).
 * - `error`: the server answered with a failure. Retrying may help.
 */
export type LoadErrorKind = "not-found" | "offline" | "error";

/** RN's fetch rejects with a TypeError("Network request failed") when offline. */
function isNetworkFailure(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : "";
  return /network request failed|network error|failed to fetch|timed? ?out|offline/i.test(
    message
  );
}

export function loadErrorKind(error: unknown): LoadErrorKind {
  if (error instanceof ApiError) {
    return error.status === 404 ? "not-found" : "error";
  }
  return isNetworkFailure(error) ? "offline" : "error";
}
