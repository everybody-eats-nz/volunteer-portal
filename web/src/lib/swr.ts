import type { SWRConfiguration } from "swr";

/** Thrown by `fetchJson` for any non-2xx response. */
export class FetchError extends Error {
  readonly status: number;
  /** The API's own `{ error }` message, when it sent one. */
  readonly apiError: string | null;

  constructor(status: number, apiError: string | null) {
    super(apiError ?? `Request failed (${status})`);
    this.name = "FetchError";
    this.status = status;
    this.apiError = apiError;
  }
}

/**
 * A message fit to show a person: the API's own explanation when it gave one,
 * otherwise the caller's friendly fallback.
 */
export function describeError(error: unknown, fallback: string) {
  return error instanceof FetchError && error.apiError
    ? error.apiError
    : fallback;
}

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    const apiError =
      body && typeof body === "object" && "error" in body
        ? (body as { error: unknown }).error
        : null;
    throw new FetchError(
      res.status,
      typeof apiError === "string" ? apiError : null
    );
  }
  return res.json() as Promise<T>;
}

const MAX_ERROR_RETRIES = 3;
const ERROR_RETRY_INTERVAL_MS = 5000;

export const swrConfig: SWRConfiguration = {
  fetcher: fetchJson,
  // A 4xx (bad filter, missing record, lost permission) won't fix itself, so
  // only server and network failures are retried, with exponential backoff.
  onErrorRetry: (error, _key, _config, revalidate, { retryCount }) => {
    if (error instanceof FetchError && error.status < 500) return;
    if (retryCount >= MAX_ERROR_RETRIES) return;
    setTimeout(
      () => revalidate({ retryCount }),
      ERROR_RETRY_INTERVAL_MS * 2 ** retryCount
    );
  },
};
